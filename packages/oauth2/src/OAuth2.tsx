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

export interface OAuth2Config {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	authorizeEndpoint: string;
	tokenEndpoint: string;
	scope: string;
}

export function generateState(): string {
	return randomBytes(32).toString('base64url');
}

export function authorizeUrl(config: OAuth2Config, state: string): string {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		scope: config.scope,
		state,
	});
	return `${config.authorizeEndpoint}?${params.toString()}`;
}

export function base64EncodeString(str: string): string {
	return Buffer.from(str).toString('base64');
}
