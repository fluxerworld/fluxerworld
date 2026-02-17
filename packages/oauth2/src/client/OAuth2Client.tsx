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
import type {IOAuth2Client} from '@fluxer/oauth2/src/client/IOAuth2Client';
import type {OAuth2ClientConfig} from '@fluxer/oauth2/src/config/OAuth2ClientConfig';
import {FetchHttpClient} from '@fluxer/oauth2/src/http/FetchHttpClient';
import type {IOAuth2HttpClient} from '@fluxer/oauth2/src/http/IOAuth2HttpClient';
import type {IOAuth2Logger} from '@fluxer/oauth2/src/logging/IOAuth2Logger';
import type {OAuth2TokenResponse} from '@fluxer/oauth2/src/models/OAuth2TokenResponse';
import type {OAuth2UserInfo} from '@fluxer/oauth2/src/models/OAuth2UserInfo';

export interface OAuth2ClientDependencies {
	httpClient?: IOAuth2HttpClient;
	logger?: IOAuth2Logger;
}

export class OAuth2Client implements IOAuth2Client {
	private readonly httpClient: IOAuth2HttpClient;
	private readonly logger?: IOAuth2Logger;

	constructor(
		private readonly config: OAuth2ClientConfig,
		dependencies?: OAuth2ClientDependencies,
	) {
		this.httpClient = dependencies?.httpClient ?? new FetchHttpClient();
		this.logger = dependencies?.logger;
	}

	generateState(): string {
		return randomBytes(32).toString('base64url');
	}

	createAuthorizationUrl(state: string): string {
		const url = new URL(this.config.endpoints.authorizeEndpoint);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('client_id', this.config.clientId);
		url.searchParams.set('redirect_uri', this.config.redirectUri);
		url.searchParams.set('scope', this.config.scope);
		url.searchParams.set('state', state);
		return url.toString();
	}

	async exchangeCodeForToken(code: string): Promise<OAuth2TokenResponse | null> {
		try {
			const response = await this.httpClient.request(this.config.endpoints.tokenEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					grant_type: 'authorization_code',
					code,
					redirect_uri: this.config.redirectUri,
					client_id: this.config.clientId,
					client_secret: this.config.clientSecret,
				}),
			});

			if (!response.ok) {
				this.logger?.warn(
					{status: response.status, tokenEndpoint: this.config.endpoints.tokenEndpoint},
					'OAuth2 code exchange failed',
				);
				return null;
			}

			return (await response.json()) as OAuth2TokenResponse;
		} catch (error) {
			this.logger?.error(
				{error: this.formatError(error), tokenEndpoint: this.config.endpoints.tokenEndpoint},
				'OAuth2 code exchange error',
			);
			return null;
		}
	}

	async fetchCurrentUser(accessToken: string): Promise<OAuth2UserInfo | null> {
		try {
			const response = await this.httpClient.request(this.config.endpoints.userInfoEndpoint, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (!response.ok) {
				this.logger?.warn(
					{status: response.status, userInfoEndpoint: this.config.endpoints.userInfoEndpoint},
					'OAuth2 user fetch failed',
				);
				return null;
			}

			return (await response.json()) as OAuth2UserInfo;
		} catch (error) {
			this.logger?.error(
				{error: this.formatError(error), userInfoEndpoint: this.config.endpoints.userInfoEndpoint},
				'OAuth2 user fetch error',
			);
			return null;
		}
	}

	async revokeAccessToken(accessToken: string): Promise<void> {
		try {
			const response = await this.httpClient.request(this.config.endpoints.revokeEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: this.createBasicAuthorizationHeader(),
				},
				body: new URLSearchParams({
					token: accessToken,
					token_type_hint: 'access_token',
				}),
			});

			if (!response.ok) {
				this.logger?.warn(
					{status: response.status, revokeEndpoint: this.config.endpoints.revokeEndpoint},
					'OAuth2 token revocation failed',
				);
			}
		} catch (error) {
			this.logger?.warn(
				{error: this.formatError(error), revokeEndpoint: this.config.endpoints.revokeEndpoint},
				'OAuth2 token revocation failed',
			);
		}
	}

	private createBasicAuthorizationHeader(): string {
		const credentials = `${this.config.clientId}:${this.config.clientSecret}`;
		return `Basic ${Buffer.from(credentials).toString('base64')}`;
	}

	private formatError(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}
}

export function createOAuth2Client(config: OAuth2ClientConfig, dependencies?: OAuth2ClientDependencies): IOAuth2Client {
	return new OAuth2Client(config, dependencies);
}
