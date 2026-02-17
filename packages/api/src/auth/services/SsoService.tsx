/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {createHash, randomBytes} from 'node:crypto';
import type {AuthService} from '@fluxer/api/src/auth/AuthService';
import {
	parseTokenEndpointResponse,
	sanitizeSsoRedirectTo,
	tryDiscoverOidcProviderMetadata,
} from '@fluxer/api/src/auth/services/SsoUtils';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {IDiscriminatorService} from '@fluxer/api/src/infrastructure/DiscriminatorService';
import type {KVActivityTracker} from '@fluxer/api/src/infrastructure/KVActivityTracker';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {InstanceConfigRepository, InstanceSsoConfig} from '@fluxer/api/src/instance/InstanceConfigRepository';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import {UserSettings} from '@fluxer/api/src/models/UserSettings';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import * as FetchUtils from '@fluxer/api/src/utils/FetchUtils';
import {generateRandomUsername} from '@fluxer/api/src/utils/UsernameGenerator';
import {deriveUsernameFromDisplayName} from '@fluxer/api/src/utils/UsernameSuggestionUtils';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {SsoRequiredError} from '@fluxer/errors/src/domains/auth/SsoRequiredError';
import {FeatureTemporarilyDisabledError} from '@fluxer/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {createPublicInternetRequestUrlPolicy} from '@fluxer/http_client/src/PublicInternetRequestUrlPolicy';
import {ms, seconds} from 'itty-time';
import {
	type CryptoKey,
	createRemoteJWKSet,
	decodeJwt,
	type FlattenedJWSInput,
	type JSONWebKeySet,
	type JWSHeaderParameters,
	type JWTPayload,
	jwtVerify,
} from 'jose';

interface SsoStatePayload {
	codeVerifier: string;
	nonce: string;
	redirectTo?: string;
	createdAt: number;
}

export interface PublicSsoStatus {
	enabled: boolean;
	enforced: boolean;
	display_name: string | null;
	redirect_uri: string;
}

interface ResolvedSsoConfig extends InstanceSsoConfig {
	redirectUri: string;
	scope: string;
	ready: boolean;
	providerId: string;
	isTestProvider: boolean;
	issuerForVerification: string | null;
}

interface RemoteJwkSetResolver {
	(protectedHeader?: JWSHeaderParameters, token?: FlattenedJWSInput): Promise<CryptoKey>;
	coolingDown: boolean;
	fresh: boolean;
	reloading: boolean;
	reload: () => Promise<void>;
	jwks: () => JSONWebKeySet | undefined;
}

interface JwksCacheEntry {
	jwks: RemoteJwkSetResolver;
	cachedAt: number;
}

export class SsoService {
	private readonly logger = Logger.child({logger: 'SsoService'});
	private static readonly STATE_TTL_SECONDS = seconds('10 minutes');
	private static readonly DISCOVERY_TTL_SECONDS = seconds('1 hour');
	private static readonly JWKS_CACHE_TTL_MS = ms('1 hour');
	private static readonly SSO_REQUEST_URL_POLICY = createPublicInternetRequestUrlPolicy();
	private readonly jwksCache = new Map<string, JwksCacheEntry>();

	constructor(
		private readonly instanceConfigRepository: InstanceConfigRepository,
		private readonly cacheService: ICacheService,
		private readonly userRepository: IUserRepository,
		private readonly discriminatorService: IDiscriminatorService,
		private readonly snowflakeService: SnowflakeService,
		private readonly authService: AuthService,
		private readonly kvActivityTracker: KVActivityTracker,
	) {}

	async getPublicStatus(): Promise<PublicSsoStatus> {
		const config = await this.getResolvedConfig();
		return {
			enabled: config.enabled && config.ready,
			enforced: config.enabled && config.ready,
			display_name: config.displayName ?? null,
			redirect_uri: config.redirectUri,
		};
	}

	async isEnforced(): Promise<boolean> {
		const config = await this.getResolvedConfig();
		return config.enabled && config.ready;
	}

	async startLogin(redirectTo?: string): Promise<{authorization_url: string; state: string; redirect_uri: string}> {
		const config = await this.requireReadyConfig();

		const state = this.randomState();
		const codeVerifier = this.randomCodeVerifier();
		const codeChallenge = this.buildCodeChallenge(codeVerifier);
		const nonce = this.randomNonce();

		const statePayload: SsoStatePayload = {
			codeVerifier,
			nonce,
			redirectTo: sanitizeSsoRedirectTo(redirectTo),
			createdAt: Date.now(),
		};

		await this.cacheService.set(this.buildStateCacheKey(state), statePayload, SsoService.STATE_TTL_SECONDS);

		const searchParams = new URLSearchParams({
			response_type: 'code',
			client_id: config.clientId ?? '',
			redirect_uri: config.redirectUri,
			scope: config.scope,
			state,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256',
			nonce,
		});

		let authorizationUrlString: string;
		try {
			const authorizationUrl = new URL(config.authorizationUrl ?? '');
			for (const [k, v] of searchParams.entries()) {
				authorizationUrl.searchParams.set(k, v);
			}
			authorizationUrlString = authorizationUrl.toString();
		} catch {
			if (config.isTestProvider) {
				const joiner = (config.authorizationUrl ?? '').includes('?') ? '&' : '?';
				authorizationUrlString = `${config.authorizationUrl}${joiner}${searchParams.toString()}`;
			} else {
				throw new FeatureTemporarilyDisabledError();
			}
		}

		return {authorization_url: authorizationUrlString, state, redirect_uri: config.redirectUri};
	}

	async completeLogin({
		code,
		state,
		request,
	}: {
		code: string;
		state: string;
		request: Request;
	}): Promise<{token: string; user_id: string; redirect_to: string}> {
		const config = await this.requireReadyConfig();

		const statePayload = await this.cacheService.getAndDelete<SsoStatePayload>(this.buildStateCacheKey(state));
		if (!statePayload) {
			throw InputValidationError.create('state', 'Invalid or expired SSO state');
		}

		const tokenResponse = await this.exchangeCode({
			code,
			codeVerifier: statePayload.codeVerifier,
			config,
		});

		const claims = await this.resolveClaims(tokenResponse, config, statePayload.nonce);

		const user = await this.resolveUserFromClaims(claims, config);
		const {token, user_id} = await this.authService.createAuthSessionForUser(user, request);

		return {token, user_id, redirect_to: statePayload.redirectTo ?? ''};
	}

	private async resolveUserFromClaims(
		claims: {email: string; emailVerified: boolean; name?: string | null},
		config: ResolvedSsoConfig,
	): Promise<User> {
		const emailLower = claims.email.toLowerCase();
		const existingUser = await this.userRepository.findByEmail(emailLower);
		if (existingUser) {
			return existingUser;
		}

		if (!config.autoProvision) {
			throw new SsoRequiredError();
		}

		return await this.provisionUserFromClaims(claims, config);
	}

	private async provisionUserFromClaims(
		claims: {email: string; emailVerified: boolean; name?: string | null},
		config: ResolvedSsoConfig,
	): Promise<User> {
		const userId = (await this.snowflakeService.generate()) as UserID;
		const baseName = claims.name?.trim() || claims.email.split('@')[0] || generateRandomUsername();
		const username = deriveUsernameFromDisplayName(baseName) ?? generateRandomUsername();
		const discriminatorResult = await this.discriminatorService.generateDiscriminator({username});
		if (!discriminatorResult.available) {
			throw InputValidationError.create('username', 'Unable to allocate discriminator for SSO user');
		}

		const now = new Date();
		const traits = new Set<string>(['sso', `sso:${config.providerId}`]);

		const userRow = {
			user_id: userId,
			username,
			discriminator: discriminatorResult.discriminator,
			global_name: claims.name?.substring(0, 256) ?? username,
			bot: false,
			system: false,
			email: claims.email.toLowerCase(),
			email_verified: claims.emailVerified,
			email_bounced: false,
			phone: null,
			password_hash: null,
			password_last_changed_at: null,
			totp_secret: null,
			authenticator_types: null,
			avatar_hash: null,
			avatar_color: null,
			banner_hash: null,
			banner_color: null,
			bio: null,
			pronouns: null,
			accent_color: null,
			date_of_birth: null,
			locale: null,
			flags: 0n,
			premium_type: null,
			premium_since: null,
			premium_until: null,
			premium_will_cancel: null,
			premium_billing_cycle: null,
			premium_lifetime_sequence: null,
			stripe_subscription_id: null,
			stripe_customer_id: null,
			has_ever_purchased: false,
			suspicious_activity_flags: 0,
			terms_agreed_at: now,
			privacy_agreed_at: now,
			last_active_at: now,
			last_active_ip: null,
			temp_banned_until: null,
			pending_bulk_message_deletion_at: null,
			pending_bulk_message_deletion_channel_count: null,
			pending_bulk_message_deletion_message_count: null,
			pending_deletion_at: null,
			deletion_reason_code: null,
			deletion_public_reason: null,
			deletion_audit_log_reason: null,
			acls: new Set<string>(),
			traits,
			first_refund_at: null,
			gift_inventory_server_seq: null,
			gift_inventory_client_seq: null,
			premium_onboarding_dismissed_at: null,
			version: 1,
		} as const;

		const user = await this.userRepository.create(userRow);

		await this.userRepository.upsertSettings(
			UserSettings.getDefaultUserSettings({
				userId,
				locale: 'en-US',
				isAdult: true,
			}),
		);

		await this.kvActivityTracker.updateActivity(user.id, now);

		return user;
	}

	private async resolveClaims(
		tokenResponse: {id_token?: string; access_token?: string},
		config: ResolvedSsoConfig,
		expectedNonce: string,
	): Promise<{email: string; emailVerified: boolean; name?: string | null}> {
		if (config.isTestProvider) {
			const email = tokenResponse.id_token || tokenResponse.access_token;
			if (!email) throw InputValidationError.create('code', 'SSO test code missing email payload');
			this.validateEmailAgainstAllowlist(email, config.allowedEmailDomains);
			return {email, emailVerified: true, name: 'Test SSO User'};
		}

		let claims: JWTPayload | null = null;

		if (tokenResponse.id_token) {
			if (!config.jwksUrl) {
				this.logger.warn('SSO id_token returned but no JWKS URL is configured; ignoring id_token claims');
			} else {
				claims = await this.verifyIdToken(tokenResponse.id_token, config, expectedNonce);
			}
		}

		let userInfo: Record<string, unknown> | null = null;
		if (config.userInfoUrl && tokenResponse.access_token) {
			userInfo = await this.fetchUserInfo(config.userInfoUrl, tokenResponse.access_token);
		}

		if (!claims && !userInfo) {
			throw InputValidationError.create('sso', 'SSO is misconfigured (missing JWKS or user info endpoint)');
		}

		const email =
			(userInfo?.['email'] as string | undefined) ??
			(claims?.['email'] as string | undefined) ??
			(() => {
				throw InputValidationError.create('email', 'SSO provider did not return an email');
			})();

		const emailVerified =
			this.coerceEmailVerified(userInfo?.['email_verified']) ??
			this.coerceEmailVerified(claims?.['email_verified']) ??
			false;

		const name = (userInfo?.['name'] as string | undefined) ?? (claims?.['name'] as string | undefined) ?? null;

		this.validateEmailAgainstAllowlist(email, config.allowedEmailDomains);

		return {email, emailVerified, name};
	}

	private async verifyIdToken(idToken: string, config: ResolvedSsoConfig, expectedNonce: string): Promise<JWTPayload> {
		try {
			if (config.jwksUrl) {
				const jwks = await this.getOrCreateJwks(config.jwksUrl);
				const {payload} = await jwtVerify(idToken, jwks, {
					issuer: config.issuerForVerification ?? undefined,
					audience: config.clientId ?? undefined,
					clockTolerance: 10,
				});
				const nonce = payload['nonce'];
				if (nonce === undefined) {
					this.logger.warn('SSO id_token missing required nonce claim');
					throw new Error('nonce missing');
				}
				if (typeof nonce !== 'string' || nonce.length === 0 || nonce !== expectedNonce) {
					throw new Error('nonce mismatch');
				}
				return payload;
			}
			return decodeJwt(idToken);
		} catch (error) {
			this.logger.error({error}, 'Failed to verify SSO id_token');
			throw InputValidationError.create('id_token', 'Invalid SSO token');
		}
	}

	private async getOrCreateJwks(jwksUrl: string): Promise<RemoteJwkSetResolver> {
		await this.validatePublicOutboundUrl(jwksUrl, 'jwks_url');
		const now = Date.now();
		const cached = this.jwksCache.get(jwksUrl);

		if (cached && now - cached.cachedAt < SsoService.JWKS_CACHE_TTL_MS) {
			return cached.jwks;
		}

		const jwks = createRemoteJWKSet(new URL(jwksUrl));
		this.jwksCache.set(jwksUrl, {jwks, cachedAt: now});

		if (this.jwksCache.size > 10) {
			for (const [url, entry] of this.jwksCache.entries()) {
				if (now - entry.cachedAt >= SsoService.JWKS_CACHE_TTL_MS) {
					this.jwksCache.delete(url);
				}
			}
		}

		return jwks;
	}

	private async fetchUserInfo(userInfoUrl: string, accessToken: string): Promise<Record<string, unknown>> {
		const resp = await FetchUtils.sendRequest({
			url: userInfoUrl,
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json',
			},
			timeout: ms('15 seconds'),
			serviceName: 'sso_user_info',
		});

		if (resp.status < 200 || resp.status >= 300) {
			throw InputValidationError.create('access_token', 'Failed to fetch SSO user info');
		}

		try {
			const rawBody = await FetchUtils.streamToString(resp.stream);
			return JSON.parse(rawBody) as Record<string, unknown>;
		} catch {
			throw InputValidationError.create('access_token', 'Failed to parse SSO user info response');
		}
	}

	private async exchangeCode({
		code,
		codeVerifier,
		config,
	}: {
		code: string;
		codeVerifier: string;
		config: ResolvedSsoConfig;
	}): Promise<{id_token?: string; access_token?: string}> {
		if (config.isTestProvider) {
			return {id_token: code};
		}

		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: config.redirectUri,
			client_id: config.clientId ?? '',
			code_verifier: codeVerifier,
		});

		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/x-www-form-urlencoded',
		};

		if (config.clientSecret) {
			const encoded = Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64');
			headers['Authorization'] = `Basic ${encoded}`;
		}

		const resp = await FetchUtils.sendRequest({
			url: config.tokenUrl ?? '',
			method: 'POST',
			headers,
			body,
			timeout: ms('15 seconds'),
			serviceName: 'sso_token_exchange',
		});

		if (resp.status < 200 || resp.status >= 300) {
			throw InputValidationError.create('code', 'Invalid SSO authorization code');
		}

		const rawBody = await FetchUtils.streamToString(resp.stream);
		return parseTokenEndpointResponse(resp.headers.get('content-type'), rawBody);
	}

	private buildCodeChallenge(codeVerifier: string): string {
		return createHash('sha256').update(codeVerifier).digest('base64url');
	}

	private randomCodeVerifier(): string {
		return randomBytes(32).toString('base64url');
	}

	private randomState(): string {
		return randomBytes(16).toString('hex');
	}

	private randomNonce(): string {
		return randomBytes(16).toString('base64url');
	}

	private buildStateCacheKey(state: string): string {
		return `sso:state:${state}`;
	}

	private buildDiscoveryCacheKey(issuer: string): string {
		const key = createHash('sha256').update(issuer).digest('hex').slice(0, 32);
		return `sso:oidc-discovery:${key}`;
	}

	private coerceEmailVerified(value: unknown): boolean | undefined {
		if (value === true || value === false) return value;
		if (typeof value === 'string') {
			const v = value.trim().toLowerCase();
			if (v === 'true') return true;
			if (v === 'false') return false;
		}
		return undefined;
	}

	private validateEmailAgainstAllowlist(email: string, domains: Array<string>): void {
		if (!domains || domains.length === 0) return;
		const domain = email.split('@')[1]?.toLowerCase() ?? '';
		const allowed = domains.map((d) => d.toLowerCase().trim()).filter(Boolean);
		if (!allowed.includes(domain)) {
			throw InputValidationError.create('email', 'Email domain is not allowed for SSO');
		}
	}

	private async getResolvedConfig(): Promise<ResolvedSsoConfig> {
		const stored = await this.instanceConfigRepository.getSsoConfig();
		const redirectUri = stored.redirectUri ?? `${Config.endpoints.webApp}/auth/sso/callback`;
		const scope = stored.scope?.trim() || 'openid email profile';
		const providerId = stored.issuer || stored.authorizationUrl || 'sso';

		let authorizationUrl = stored.authorizationUrl;
		let tokenUrl = stored.tokenUrl;
		let userInfoUrl = stored.userInfoUrl;
		let jwksUrl = stored.jwksUrl;
		let issuerForVerification = stored.issuer;

		const isTestProvider =
			authorizationUrl === 'test' ||
			tokenUrl === 'test' ||
			(Config.dev.testModeEnabled && (authorizationUrl?.startsWith('test-') ?? false));

		const validatedIssuer =
			stored.issuer && !isTestProvider
				? await this.validateOptionalPublicOutboundUrl(stored.issuer, 'issuer')
				: stored.issuer;
		if (validatedIssuer) {
			const cacheKey = this.buildDiscoveryCacheKey(validatedIssuer);
			let discovered = await this.cacheService.get<{
				issuer: string;
				authorization_endpoint?: string;
				token_endpoint?: string;
				userinfo_endpoint?: string;
				jwks_uri?: string;
			}>(cacheKey);

			if (!discovered && (!authorizationUrl || !tokenUrl || !jwksUrl || !userInfoUrl)) {
				discovered = await tryDiscoverOidcProviderMetadata(validatedIssuer);
				if (discovered) {
					await this.cacheService.set(cacheKey, discovered, SsoService.DISCOVERY_TTL_SECONDS);
				}
			}

			authorizationUrl = authorizationUrl ?? discovered?.authorization_endpoint ?? null;
			tokenUrl = tokenUrl ?? discovered?.token_endpoint ?? null;
			userInfoUrl = userInfoUrl ?? discovered?.userinfo_endpoint ?? null;
			jwksUrl = jwksUrl ?? discovered?.jwks_uri ?? null;
			issuerForVerification = discovered?.issuer ?? validatedIssuer;
		}

		if (!isTestProvider) {
			tokenUrl = await this.validateOptionalPublicOutboundUrl(tokenUrl, 'token_url');
			userInfoUrl = await this.validateOptionalPublicOutboundUrl(userInfoUrl, 'user_info_url');
			jwksUrl = await this.validateOptionalPublicOutboundUrl(jwksUrl, 'jwks_url');
		}

		const ready = stored.enabled && Boolean(authorizationUrl) && Boolean(tokenUrl) && Boolean(stored.clientId);

		return {
			...stored,
			authorizationUrl,
			tokenUrl,
			userInfoUrl,
			jwksUrl,
			redirectUri,
			scope,
			ready,
			providerId,
			isTestProvider,
			issuerForVerification,
		};
	}

	private async validatePublicOutboundUrl(rawUrl: string, fieldName: string): Promise<URL> {
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(rawUrl);
		} catch {
			throw InputValidationError.create(fieldName, 'Invalid URL');
		}

		await SsoService.SSO_REQUEST_URL_POLICY.validate(parsedUrl, {
			phase: 'initial',
			redirectCount: 0,
		});
		return parsedUrl;
	}

	private async validateOptionalPublicOutboundUrl(rawUrl: string | null, fieldName: string): Promise<string | null> {
		if (!rawUrl) {
			return null;
		}

		try {
			const validUrl = await this.validatePublicOutboundUrl(rawUrl, fieldName);
			return validUrl.toString();
		} catch (error) {
			this.logger.warn({fieldName, rawUrl, error}, 'Ignoring SSO URL that failed outbound policy validation');
			return null;
		}
	}

	private async requireReadyConfig(): Promise<ResolvedSsoConfig> {
		const config = await this.getResolvedConfig();
		if (!config.ready) {
			throw new FeatureTemporarilyDisabledError();
		}
		return config;
	}
}
