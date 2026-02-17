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

import {randomBytes} from 'node:crypto';
import type {ApplicationID, UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {
	OAuth2AccessTokenRow,
	OAuth2AuthorizationCodeRow,
	OAuth2RefreshTokenRow,
} from '@fluxer/api/src/database/types/OAuth2Types';
import {Logger} from '@fluxer/api/src/Logger';
import type {Application} from '@fluxer/api/src/models/Application';
import {ApplicationRepository} from '@fluxer/api/src/oauth/repositories/ApplicationRepository';
import type {IApplicationRepository} from '@fluxer/api/src/oauth/repositories/IApplicationRepository';
import type {IOAuth2TokenRepository} from '@fluxer/api/src/oauth/repositories/IOAuth2TokenRepository';
import {OAuth2TokenRepository} from '@fluxer/api/src/oauth/repositories/OAuth2TokenRepository';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {mapUserToOAuthResponse} from '@fluxer/api/src/user/UserMappers';
import {verifyPassword} from '@fluxer/api/src/utils/PasswordUtils';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {ADMIN_OAUTH2_APPLICATION_ID} from '@fluxer/constants/src/Core';
import {AccessDeniedError} from '@fluxer/errors/src/domains/core/AccessDeniedError';
import {InvalidRequestError} from '@fluxer/errors/src/domains/core/InvalidRequestError';
import {InvalidTokenError} from '@fluxer/errors/src/domains/core/InvalidTokenError';
import {InvalidClientError} from '@fluxer/errors/src/domains/oauth/InvalidClientError';
import {InvalidClientSecretError} from '@fluxer/errors/src/domains/oauth/InvalidClientSecretError';
import {InvalidGrantError} from '@fluxer/errors/src/domains/oauth/InvalidGrantError';
import {InvalidRedirectUriError} from '@fluxer/errors/src/domains/oauth/InvalidRedirectUriError';
import {InvalidScopeError} from '@fluxer/errors/src/domains/oauth/InvalidScopeError';
import {MissingClientSecretError} from '@fluxer/errors/src/domains/oauth/MissingClientSecretError';
import {MissingRedirectUriError} from '@fluxer/errors/src/domains/oauth/MissingRedirectUriError';
import type {OAuthScope} from '@fluxer/schema/src/domains/oauth/OAuthSchemas';
import {seconds} from 'itty-time';

interface OAuth2ServiceDeps {
	userRepository: IUserRepository;
	applicationRepository?: IApplicationRepository;
	oauth2TokenRepository?: IOAuth2TokenRepository;
	cacheService?: ICacheService;
}

const PREFERRED_SCOPE_ORDER = ['identify', 'email', 'guilds', 'connections', 'bot', 'admin'];

function sortScopes(scope: Set<string>): Array<string> {
	return Array.from(scope).sort((a, b) => {
		const ai = PREFERRED_SCOPE_ORDER.indexOf(a);
		const bi = PREFERRED_SCOPE_ORDER.indexOf(b);
		if (ai === -1 && bi === -1) return a.localeCompare(b);
		if (ai === -1) return 1;
		if (bi === -1) return -1;
		return ai - bi;
	});
}

export const ACCESS_TOKEN_TTL_SECONDS = seconds('7 days');

export class OAuth2Service {
	private applications: IApplicationRepository;
	private tokens: IOAuth2TokenRepository;
	private static readonly ALLOWED_SCOPES = ['identify', 'email', 'guilds', 'connections', 'bot', 'admin'];

	constructor(private readonly deps: OAuth2ServiceDeps) {
		this.applications = deps.applicationRepository ?? new ApplicationRepository();
		this.tokens = deps.oauth2TokenRepository ?? new OAuth2TokenRepository();
	}

	private parseScope(scope: string): Array<OAuthScope> {
		const parts = scope.split(/\s+/).filter(Boolean);
		return parts as Array<OAuthScope>;
	}

	private validateRedirectUri(application: Application, redirectUri: string): boolean {
		if (application.oauth2RedirectUris.size === 0) {
			return false;
		}
		return application.oauth2RedirectUris.has(redirectUri);
	}

	async authorizeAndConsent(params: {
		clientId: string;
		redirectUri?: string;
		scope: string;
		state?: string;
		codeChallenge?: string;
		codeChallengeMethod?: 'S256' | 'plain';
		responseType?: 'code';
		userId: UserID;
	}): Promise<{redirectTo: string}> {
		const parsedClientId = BigInt(params.clientId) as ApplicationID;
		const application = await this.applications.getApplication(parsedClientId);

		if (!application) {
			throw new InvalidClientError();
		}

		const scopeSet = new Set<string>(this.parseScope(params.scope));
		for (const s of scopeSet) {
			if (!OAuth2Service.ALLOWED_SCOPES.includes(s)) {
				throw new InvalidScopeError();
			}
		}

		if (scopeSet.has('admin') && parsedClientId !== ADMIN_OAUTH2_APPLICATION_ID) {
			throw new InvalidScopeError();
		}

		if (scopeSet.has('bot') && !application.botIsPublic && params.userId !== application.ownerUserId) {
			throw new AccessDeniedError();
		}

		const isBotOnly = scopeSet.size === 1 && scopeSet.has('bot');

		const redirectUri = params.redirectUri;
		const requireRedirect = !isBotOnly || application.botRequireCodeGrant;

		if (!redirectUri && requireRedirect) {
			throw new MissingRedirectUriError();
		}

		if (redirectUri && !this.validateRedirectUri(application, redirectUri)) {
			throw new InvalidRedirectUriError();
		}

		const resolvedRedirectUri = redirectUri ?? Config.endpoints.webApp;

		let loc: URL;
		try {
			loc = new URL(resolvedRedirectUri);
		} catch {
			throw new InvalidRequestError();
		}

		const codeRow: OAuth2AuthorizationCodeRow = {
			code: randomBytes(32).toString('base64url'),
			application_id: application.applicationId,
			user_id: params.userId,
			redirect_uri: loc.toString(),
			scope: scopeSet,
			nonce: null,
			created_at: new Date(),
		};

		await this.tokens.createAuthorizationCode(codeRow);

		loc.searchParams.set('code', codeRow.code);
		if (params.state) {
			loc.searchParams.set('state', params.state);
		}

		return {redirectTo: loc.toString()};
	}

	private basicAuth(credentialsHeader?: string): {clientId: string; clientSecret: string} | null {
		if (!credentialsHeader) {
			return null;
		}

		const m = /^Basic\s+(.+)$/.exec(credentialsHeader);
		if (!m) {
			return null;
		}

		const decoded = Buffer.from(m[1], 'base64').toString('utf8');
		const idx = decoded.indexOf(':');

		if (idx < 0) {
			return null;
		}

		return {
			clientId: decoded.slice(0, idx),
			clientSecret: decoded.slice(idx + 1),
		};
	}

	private async issueTokens(args: {application: Application; userId: UserID | null; scope: Set<string>}): Promise<{
		accessToken: OAuth2AccessTokenRow;
		refreshToken?: OAuth2RefreshTokenRow;
		token_type: 'Bearer';
		expires_in: number;
		scope?: string;
	}> {
		const accessToken: OAuth2AccessTokenRow = {
			token_: randomBytes(32).toString('base64url'),
			application_id: args.application.applicationId,
			user_id: args.userId,
			scope: args.scope,
			created_at: new Date(),
		};

		const createdAccess = await this.tokens.createAccessToken(accessToken);

		let refreshToken: OAuth2RefreshTokenRow | undefined;
		if (args.userId) {
			const row: OAuth2RefreshTokenRow = {
				token_: randomBytes(32).toString('base64url'),
				application_id: args.application.applicationId,
				user_id: args.userId,
				scope: args.scope,
				created_at: new Date(),
			};
			const created = await this.tokens.createRefreshToken(row);
			refreshToken = created.toRow();
		}

		return {
			accessToken: createdAccess.toRow(),
			refreshToken,
			token_type: 'Bearer',
			expires_in: ACCESS_TOKEN_TTL_SECONDS,
			scope: sortScopes(args.scope).join(' '),
		};
	}

	async tokenExchange(params: {
		headersAuthorization?: string;
		grantType: 'authorization_code' | 'refresh_token';
		code?: string;
		refreshToken?: string;
		redirectUri?: string;
		clientId?: string;
		clientSecret?: string;
	}): Promise<{
		access_token: string;
		token_type: 'Bearer';
		expires_in: number;
		scope?: string;
		refresh_token?: string;
	}> {
		Logger.debug(
			{
				grant_type: params.grantType,
				client_id_present: !!params.clientId || /^Basic\s+/.test(params.headersAuthorization ?? ''),
				has_basic_auth: /^Basic\s+/.test(params.headersAuthorization ?? ''),
				code_present: !!params.code,
				refresh_token_present: !!params.refreshToken,
				redirect_uri_present: !!params.redirectUri,
			},
			'OAuth2 tokenExchange start',
		);

		const basic = this.basicAuth(params.headersAuthorization);
		const clientId = params.clientId ?? basic?.clientId ?? '';
		const clientSecret = params.clientSecret ?? basic?.clientSecret;
		const parsedClientId = BigInt(clientId) as ApplicationID;
		const application = await this.applications.getApplication(parsedClientId);

		if (!application) {
			Logger.debug({client_id_len: clientId.length}, 'OAuth2 tokenExchange: unknown application');
			throw new InvalidClientError();
		}

		if (!clientSecret) {
			Logger.debug(
				{application_id: application.applicationId.toString()},
				'OAuth2 tokenExchange: missing client_secret',
			);
			throw new MissingClientSecretError();
		}

		if (application.clientSecretHash) {
			const ok = await verifyPassword({password: clientSecret, passwordHash: application.clientSecretHash});
			if (!ok) {
				Logger.debug(
					{application_id: application.applicationId.toString()},
					'OAuth2 tokenExchange: client_secret verification failed',
				);
				throw new InvalidClientSecretError();
			}
		}

		if (params.grantType === 'authorization_code') {
			const code = params.code!;
			const authCode = await this.tokens.getAuthorizationCode(code);

			if (!authCode) {
				Logger.debug({code_len: code.length}, 'OAuth2 tokenExchange: authorization code not found');
				throw new InvalidGrantError();
			}

			if (authCode.applicationId !== application.applicationId) {
				Logger.debug(
					{application_id: application.applicationId.toString()},
					'OAuth2 tokenExchange: code application mismatch',
				);
				throw new InvalidGrantError();
			}

			const expectedRedirectUri = authCode.redirectUri ?? '';
			const providedRedirectUri = params.redirectUri ?? '';

			if (expectedRedirectUri !== providedRedirectUri) {
				Logger.debug(
					{expected: expectedRedirectUri, got: providedRedirectUri},
					'OAuth2 tokenExchange: redirect_uri mismatch',
				);
				throw new InvalidGrantError();
			}

			await this.tokens.deleteAuthorizationCode(code);

			const res = await this.issueTokens({
				application,
				userId: authCode.userId,
				scope: authCode.scope,
			});

			return {
				access_token: res.accessToken.token_,
				token_type: 'Bearer',
				expires_in: res.expires_in,
				scope: res.scope,
				refresh_token: res.refreshToken?.token_,
			};
		}

		const refresh = await this.tokens.getRefreshToken(params.refreshToken!);
		if (!refresh) {
			throw new InvalidGrantError();
		}

		if (refresh.applicationId !== application.applicationId) {
			throw new InvalidGrantError();
		}

		const res = await this.issueTokens({
			application,
			userId: refresh.userId,
			scope: refresh.scope,
		});

		return {
			access_token: res.accessToken.token_,
			token_type: 'Bearer',
			expires_in: res.expires_in,
			scope: res.scope,
			refresh_token: res.refreshToken?.token_,
		};
	}

	async userInfo(accessToken: string) {
		const token = await this.tokens.getAccessToken(accessToken);
		if (!token || !token.userId) {
			throw new InvalidTokenError();
		}

		const application = await this.applications.getApplication(token.applicationId);
		if (!application) {
			throw new InvalidTokenError();
		}

		const user = await this.deps.userRepository.findUnique(token.userId);
		if (!user) {
			throw new InvalidTokenError();
		}

		const includeEmail = token.scope.has('email');
		return mapUserToOAuthResponse(user, {includeEmail});
	}

	async introspect(
		tokenStr: string,
		auth: {clientId: ApplicationID; clientSecret?: string | null},
	): Promise<{
		active: boolean;
		client_id?: string;
		sub?: string;
		scope?: string;
		token_type?: string;
		exp?: number;
		iat?: number;
	}> {
		const application = await this.applications.getApplication(auth.clientId);
		if (!application) {
			return {active: false};
		}

		if (!auth.clientSecret) {
			return {active: false};
		}

		if (application.clientSecretHash) {
			const valid = await verifyPassword({password: auth.clientSecret, passwordHash: application.clientSecretHash});
			if (!valid) {
				return {active: false};
			}
		}

		const token = await this.tokens.getAccessToken(tokenStr);
		if (!token) {
			return {active: false};
		}

		if (token.applicationId !== application.applicationId) {
			return {active: false};
		}

		return {
			active: true,
			client_id: token.applicationId.toString(),
			sub: token.userId ? token.userId.toString() : undefined,
			scope: sortScopes(token.scope).join(' '),
			token_type: 'Bearer',
			exp: Math.floor((token.createdAt.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000) / 1000),
			iat: Math.floor(token.createdAt.getTime() / 1000),
		};
	}

	async revoke(
		tokenStr: string,
		tokenTypeHint: 'access_token' | 'refresh_token' | undefined,
		auth: {clientId: ApplicationID; clientSecret?: string | null},
	): Promise<void> {
		const application = await this.applications.getApplication(auth.clientId);
		if (!application) {
			throw new InvalidClientError();
		}

		if (application.clientSecretHash) {
			const valid = auth.clientSecret
				? await verifyPassword({password: auth.clientSecret, passwordHash: application.clientSecretHash})
				: false;
			if (!valid) {
				throw new InvalidClientSecretError();
			}
		}

		if (tokenTypeHint === 'refresh_token') {
			const refresh = await this.tokens.getRefreshToken(tokenStr);
			if (refresh && refresh.applicationId === application.applicationId) {
				await this.tokens.deleteAllTokensForUserAndApplication(refresh.userId, application.applicationId);
				return;
			}
		}

		const access = await this.tokens.getAccessToken(tokenStr);
		if (access && access.applicationId === application.applicationId) {
			if (access.userId) {
				await this.tokens.deleteAllTokensForUserAndApplication(access.userId, application.applicationId);
				return;
			}

			await this.tokens.deleteAccessToken(tokenStr, application.applicationId, access.userId);
			return;
		}
	}
}
