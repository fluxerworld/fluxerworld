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

import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {ReadStateAckBulkRequest} from '@fluxer/schema/src/domains/channel/ChannelRequestSchemas';
import type {Hono} from 'hono';

export function ReadStateController(app: Hono<HonoEnv>): void {
	app.post(
		'/read-states/ack-bulk',
		RateLimitMiddleware(RateLimitConfigs.READ_STATE_ACK_BULK),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'ack_bulk_messages',
			summary: 'Mark channels as read',
			description: 'Marks multiple channels as read for the authenticated user in bulk.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Read States'],
		}),
		Validator('json', ReadStateAckBulkRequest),
		async (ctx) => {
			await ctx.get('readStateRequestService').bulkAckMessages({
				userId: ctx.get('user').id,
				data: ctx.req.valid('json'),
			});
			return ctx.body(null, 204);
		},
	);
}
