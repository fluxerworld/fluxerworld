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

import type {OAuth2Config} from '@fluxer/oauth2/src/OAuth2';
import {base64EncodeString} from '@fluxer/oauth2/src/OAuth2';

export interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	scope: string;
}

export interface LoggerInterface {
	debug(obj: Record<string, unknown> | string, msg?: string): void;
	info(obj: Record<string, unknown> | string, msg?: string): void;
	warn(obj: Record<string, unknown> | string, msg?: string): void;
	error(obj: Record<string, unknown> | string, msg?: string): void;
}

interface ExchangeCodeOptions {
	logger?: LoggerInterface;
}

export async function exchangeCode(
	config: OAuth2Config,
	code: string,
	options?: ExchangeCodeOptions,
): Promise<TokenResponse | null> {
	try {
		const response = await fetch(config.tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: config.redirectUri,
				client_id: config.clientId,
				client_secret: config.clientSecret,
			}),
		});

		if (!response.ok) {
			options?.logger?.warn(
				{status: response.status, tokenEndpoint: config.tokenEndpoint},
				'OAuth2 code exchange failed',
			);
			return null;
		}

		return (await response.json()) as TokenResponse;
	} catch (err) {
		options?.logger?.error(
			{error: err instanceof Error ? err.message : String(err), tokenEndpoint: config.tokenEndpoint},
			'OAuth2 code exchange error',
		);
		return null;
	}
}

interface RevokeTokenOptions {
	logger?: LoggerInterface;
}

export async function revokeToken(
	config: OAuth2Config,
	token: string,
	revokeEndpoint: string,
	options?: RevokeTokenOptions,
): Promise<void> {
	try {
		const basic = `Basic ${base64EncodeString(`${config.clientId}:${config.clientSecret}`)}`;
		await fetch(revokeEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: basic,
			},
			body: new URLSearchParams({
				token,
				token_type_hint: 'access_token',
			}),
		});
	} catch (err) {
		options?.logger?.warn(
			{error: err instanceof Error ? err.message : String(err), revokeEndpoint},
			'OAuth2 token revocation failed',
		);
	}
}
