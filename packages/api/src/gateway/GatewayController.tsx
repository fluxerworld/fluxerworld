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

import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {GatewayBotResponse} from '@fluxer/schema/src/domains/gateway/GatewaySchemas';

export function GatewayController(app: HonoApp) {
	app.get(
		'/gateway/bot',
		RateLimitMiddleware(RateLimitConfigs.GATEWAY_BOT_INFO),
		OpenAPI({
			operationId: 'get_gateway_bot',
			summary: 'Get gateway information',
			responseSchema: GatewayBotResponse,
			statusCode: 200,
			security: [],
			tags: ['Gateway'],
			description:
				'Retrieves gateway connection information and recommended shard count for establishing WebSocket connections.',
		}),
		async (ctx) => {
			const gatewayRequestService = ctx.get('gatewayRequestService');
			return ctx.json(await gatewayRequestService.getBotGatewayInfo(ctx.req.header('Authorization') ?? null));
		},
	);
}
