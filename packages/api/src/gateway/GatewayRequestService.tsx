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

import {Config} from '@fluxer/api/src/Config';
import type {BotAuthService} from '@fluxer/api/src/oauth/BotAuthService';
import {InvalidGatewayAuthTokenError} from '@fluxer/errors/src/domains/auth/InvalidGatewayAuthTokenError';
import {MissingGatewayAuthorizationError} from '@fluxer/errors/src/domains/auth/MissingGatewayAuthorizationError';
import type {GatewayBotResponse as GatewayBotResponseType} from '@fluxer/schema/src/domains/gateway/GatewaySchemas';
import {recordCounter} from '@fluxer/telemetry/src/Metrics';

type TokenType = 'user' | 'bot' | 'unknown';

function parseTokenType(raw: string): TokenType {
	if (raw.startsWith('flx_')) return 'user';
	const dotIndex = raw.indexOf('.');
	if (dotIndex > 0 && dotIndex < raw.length - 1) {
		const beforeDot = raw.slice(0, dotIndex);
		if (/^\d+$/.test(beforeDot)) return 'bot';
	}
	return 'unknown';
}

function extractToken(authHeader: string | null): string {
	if (!authHeader) return '';
	const lower = authHeader.toLowerCase();
	if (lower.startsWith('bot ')) return authHeader.slice(4).trim();
	if (lower.startsWith('bearer ')) return authHeader.slice(7).trim();
	return authHeader.trim();
}

export class GatewayRequestService {
	constructor(private readonly botAuthService: BotAuthService) {}

	async getBotGatewayInfo(authHeader: string | null): Promise<GatewayBotResponseType> {
		const token = extractToken(authHeader);

		if (!token) {
			recordCounter({
				name: 'gateway.connection',
				dimensions: {status: 'failed', transport: 'bot', reason: 'missing_token'},
			});
			throw new MissingGatewayAuthorizationError();
		}

		const tokenType = parseTokenType(token);
		if (tokenType !== 'bot') {
			recordCounter({
				name: 'gateway.connection',
				dimensions: {status: 'failed', transport: 'bot', reason: 'invalid_token_type'},
			});
			throw new InvalidGatewayAuthTokenError();
		}

		try {
			await this.botAuthService.validateBotToken(token);
			recordCounter({
				name: 'gateway.connection',
				dimensions: {status: 'success', transport: 'bot'},
			});
		} catch (error) {
			recordCounter({
				name: 'gateway.connection',
				dimensions: {status: 'failed', transport: 'bot', reason: 'invalid_token'},
			});
			throw error;
		}

		return {
			url: Config.endpoints.gateway,
			shards: 1,
			session_start_limit: {
				total: 1000,
				remaining: 999,
				reset_after: 14400000,
				max_concurrency: 1,
			},
		};
	}
}
