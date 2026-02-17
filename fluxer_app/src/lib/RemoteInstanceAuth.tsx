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

import AppStorage from '@app/lib/AppStorage';
import {Logger} from '@app/lib/Logger';
import type {FederationOAuth2TokenResponse} from '@fluxer/schema/src/domains/oauth2/FederationOAuth2Schemas';

const logger = new Logger('RemoteInstanceAuth');

const STORAGE_KEY_PREFIX = 'federation_token_';
const TOKEN_REFRESH_BUFFER_SECONDS = 300;
const DEFAULT_SCOPES = 'identify guilds messages.read';

export interface StoredToken {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scope: string;
	instanceDomain: string;
}

export interface OAuth2Config {
	authorizationEndpoint: string;
	tokenEndpoint: string;
	userinfoEndpoint: string;
	scopesSupported: Array<string>;
}

export interface PKCEChallenge {
	codeVerifier: string;
	codeChallenge: string;
}

interface PendingOAuth2Flow {
	instanceDomain: string;
	codeVerifier: string;
	redirectUri: string;
	state: string;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeVerifier(): Promise<string> {
	const randomBytes = crypto.getRandomValues(new Uint8Array(32));
	return base64UrlEncode(randomBytes.buffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return base64UrlEncode(hash);
}

async function generatePKCEChallenge(): Promise<PKCEChallenge> {
	const codeVerifier = await generateCodeVerifier();
	const codeChallenge = await generateCodeChallenge(codeVerifier);
	return {codeVerifier, codeChallenge};
}

function generateState(): string {
	const randomBytes = crypto.getRandomValues(new Uint8Array(16));
	return base64UrlEncode(randomBytes.buffer);
}

function getStorageKey(instanceDomain: string): string {
	return `${STORAGE_KEY_PREFIX}${instanceDomain.toLowerCase()}`;
}

class RemoteInstanceAuth {
	private tokenCache = new Map<string, StoredToken>();
	private oauth2ConfigCache = new Map<string, OAuth2Config>();
	private refreshPromises = new Map<string, Promise<StoredToken>>();
	private pendingFlow: PendingOAuth2Flow | null = null;
	private clientId: string | null = null;

	setClientId(clientId: string): void {
		this.clientId = clientId;
		logger.debug('Set OAuth2 client ID');
	}

	async loadStoredTokens(): Promise<void> {
		const keys = AppStorage.keys();
		for (const key of keys) {
			if (key.startsWith(STORAGE_KEY_PREFIX)) {
				try {
					const stored = AppStorage.getJSON<StoredToken>(key);
					if (stored?.instanceDomain) {
						this.tokenCache.set(stored.instanceDomain.toLowerCase(), stored);
						logger.debug('Loaded stored token for:', stored.instanceDomain);
					}
				} catch (err) {
					logger.warn('Failed to load stored token:', key, err);
				}
			}
		}
	}

	private persistToken(token: StoredToken): void {
		const key = getStorageKey(token.instanceDomain);
		AppStorage.setJSON(key, token);
		this.tokenCache.set(token.instanceDomain.toLowerCase(), token);
		logger.debug('Persisted token for:', token.instanceDomain);
	}

	private removeToken(instanceDomain: string): void {
		const key = getStorageKey(instanceDomain);
		AppStorage.removeItem(key);
		this.tokenCache.delete(instanceDomain.toLowerCase());
		logger.debug('Removed token for:', instanceDomain);
	}

	async getOAuth2Config(instanceDomain: string, forceRefresh = false): Promise<OAuth2Config> {
		const cacheKey = instanceDomain.toLowerCase();

		if (!forceRefresh) {
			const cached = this.oauth2ConfigCache.get(cacheKey);
			if (cached) {
				return cached;
			}
		}

		logger.debug('Fetching OAuth2 config for:', instanceDomain);

		const wellKnownUrl = `https://${instanceDomain}/.well-known/fluxer`;
		const response = await fetch(wellKnownUrl, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch instance info: ${response.status} ${response.statusText}`);
		}

		const instanceInfo = (await response.json()) as {
			oauth2?: {
				authorization_endpoint: string;
				token_endpoint: string;
				userinfo_endpoint: string;
				scopes_supported: Array<string>;
			};
			federation?: {enabled: boolean};
		};

		if (!instanceInfo.federation?.enabled) {
			throw new Error(`Instance ${instanceDomain} does not have federation enabled`);
		}

		if (!instanceInfo.oauth2) {
			throw new Error(`Instance ${instanceDomain} does not expose OAuth2 endpoints`);
		}

		const config: OAuth2Config = {
			authorizationEndpoint: instanceInfo.oauth2.authorization_endpoint,
			tokenEndpoint: instanceInfo.oauth2.token_endpoint,
			userinfoEndpoint: instanceInfo.oauth2.userinfo_endpoint,
			scopesSupported: instanceInfo.oauth2.scopes_supported,
		};

		this.oauth2ConfigCache.set(cacheKey, config);
		logger.debug('Cached OAuth2 config for:', instanceDomain);

		return config;
	}

	async getToken(instanceDomain: string): Promise<StoredToken | null> {
		const cacheKey = instanceDomain.toLowerCase();
		const cached = this.tokenCache.get(cacheKey);

		if (!cached) {
			return null;
		}

		const now = Date.now();
		const expiresIn = cached.expiresAt - now;

		if (expiresIn <= 0) {
			logger.debug('Token expired for:', instanceDomain);
			return this.refreshToken(instanceDomain, cached.refreshToken);
		}

		if (expiresIn <= TOKEN_REFRESH_BUFFER_SECONDS * 1000) {
			logger.debug('Token expiring soon for:', instanceDomain, '- refreshing');
			this.refreshToken(instanceDomain, cached.refreshToken).catch((err) => {
				logger.warn('Background token refresh failed for:', instanceDomain, err);
			});
		}

		return cached;
	}

	async initiateOAuth2Flow(instanceDomain: string, redirectUri: string, scopes?: string): Promise<string> {
		if (!this.clientId) {
			throw new Error('OAuth2 client ID not configured');
		}

		const config = await this.getOAuth2Config(instanceDomain);
		const pkce = await generatePKCEChallenge();
		const state = generateState();

		this.pendingFlow = {
			instanceDomain,
			codeVerifier: pkce.codeVerifier,
			redirectUri,
			state,
		};

		const requestedScopes = scopes ?? DEFAULT_SCOPES;
		const authUrl = new URL(config.authorizationEndpoint);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('client_id', this.clientId);
		authUrl.searchParams.set('redirect_uri', redirectUri);
		authUrl.searchParams.set('scope', requestedScopes);
		authUrl.searchParams.set('state', state);
		authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
		authUrl.searchParams.set('code_challenge_method', 'S256');

		logger.debug('Initiated OAuth2 flow for:', instanceDomain);

		return authUrl.toString();
	}

	async exchangeCode(instanceDomain: string, code: string, state: string): Promise<StoredToken> {
		if (!this.clientId) {
			throw new Error('OAuth2 client ID not configured');
		}

		if (!this.pendingFlow) {
			throw new Error('No pending OAuth2 flow');
		}

		if (this.pendingFlow.instanceDomain.toLowerCase() !== instanceDomain.toLowerCase()) {
			throw new Error('Instance domain mismatch in OAuth2 flow');
		}

		if (this.pendingFlow.state !== state) {
			throw new Error('State mismatch in OAuth2 flow - possible CSRF attack');
		}

		const config = await this.getOAuth2Config(instanceDomain);

		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: this.pendingFlow.redirectUri,
			client_id: this.clientId,
			code_verifier: this.pendingFlow.codeVerifier,
		});

		logger.debug('Exchanging authorization code for:', instanceDomain);

		const response = await fetch(config.tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
			},
			body: body.toString(),
		});

		this.pendingFlow = null;

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
		}

		const tokenResponse = (await response.json()) as FederationOAuth2TokenResponse;

		const storedToken: StoredToken = {
			accessToken: tokenResponse.access_token,
			refreshToken: tokenResponse.refresh_token,
			expiresAt: Date.now() + tokenResponse.expires_in * 1000,
			scope: tokenResponse.scope,
			instanceDomain,
		};

		this.persistToken(storedToken);

		logger.debug('Obtained access token for:', instanceDomain);

		return storedToken;
	}

	async refreshToken(instanceDomain: string, refreshTokenValue: string): Promise<StoredToken> {
		const cacheKey = instanceDomain.toLowerCase();

		const existingRefresh = this.refreshPromises.get(cacheKey);
		if (existingRefresh) {
			logger.debug('Waiting for existing refresh for:', instanceDomain);
			return existingRefresh;
		}

		const refreshPromise = this.doRefreshToken(instanceDomain, refreshTokenValue);
		this.refreshPromises.set(cacheKey, refreshPromise);

		try {
			return await refreshPromise;
		} finally {
			this.refreshPromises.delete(cacheKey);
		}
	}

	private async doRefreshToken(instanceDomain: string, refreshTokenValue: string): Promise<StoredToken> {
		if (!this.clientId) {
			throw new Error('OAuth2 client ID not configured');
		}

		const config = await this.getOAuth2Config(instanceDomain);

		const body = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshTokenValue,
			client_id: this.clientId,
		});

		logger.debug('Refreshing token for:', instanceDomain);

		const response = await fetch(config.tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
			},
			body: body.toString(),
		});

		if (!response.ok) {
			const errorText = await response.text();

			if (response.status === 400 || response.status === 401) {
				this.removeToken(instanceDomain);
				throw new Error(`Refresh token invalid for ${instanceDomain} - re-authentication required`);
			}

			throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
		}

		const tokenResponse = (await response.json()) as FederationOAuth2TokenResponse;

		const storedToken: StoredToken = {
			accessToken: tokenResponse.access_token,
			refreshToken: tokenResponse.refresh_token,
			expiresAt: Date.now() + tokenResponse.expires_in * 1000,
			scope: tokenResponse.scope,
			instanceDomain,
		};

		this.persistToken(storedToken);

		logger.debug('Refreshed token for:', instanceDomain);

		return storedToken;
	}

	hasToken(instanceDomain: string): boolean {
		return this.tokenCache.has(instanceDomain.toLowerCase());
	}

	revokeToken(instanceDomain: string): void {
		this.removeToken(instanceDomain);
		logger.debug('Revoked token for:', instanceDomain);
	}

	getAuthorizedInstances(): Array<string> {
		return Array.from(this.tokenCache.keys());
	}

	clearAllTokens(): void {
		const keys = AppStorage.keys();
		for (const key of keys) {
			if (key.startsWith(STORAGE_KEY_PREFIX)) {
				AppStorage.removeItem(key);
			}
		}
		this.tokenCache.clear();
		this.pendingFlow = null;
		logger.debug('Cleared all federation tokens');
	}

	clearCache(): void {
		this.oauth2ConfigCache.clear();
		logger.debug('Cleared OAuth2 config cache');
	}
}

const remoteInstanceAuth = new RemoteInstanceAuth();
export default remoteInstanceAuth;
