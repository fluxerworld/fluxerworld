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

import {createChannelID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import {ChannelIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {CreatePrivateChannelRequest} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import {z} from 'zod';

export function UserChannelController(app: HonoApp) {
	app.get(
		'/users/@me/channels',
		RateLimitMiddleware(RateLimitConfigs.USER_CHANNELS),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_private_channels',
			summary: 'List private channels',
			responseSchema: z.array(ChannelResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves all private channels (direct messages) accessible to the current user. Returns list of channel objects with metadata including recipient information.',
		}),
		async (ctx) => {
			const response = await ctx.get('userChannelRequestService').listPrivateChannels({
				userId: ctx.get('user').id,
				requestCache: ctx.get('requestCache'),
			});
			return ctx.json(response);
		},
	);

	app.post(
		'/users/@me/channels',
		RateLimitMiddleware(RateLimitConfigs.USER_CHANNELS),
		LoginRequired,
		Validator('json', CreatePrivateChannelRequest),
		OpenAPI({
			operationId: 'create_private_channel',
			summary: 'Create private channel',
			responseSchema: ChannelResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Creates a new private channel (direct message) between the current user and one or more recipients. Returns the newly created channel object.',
		}),
		async (ctx) => {
			const response = await ctx.get('userChannelRequestService').createPrivateChannel({
				userId: ctx.get('user').id,
				data: ctx.req.valid('json'),
				requestCache: ctx.get('requestCache'),
			});
			return ctx.json(response);
		},
	);

	app.put(
		'/users/@me/channels/:channel_id/pin',
		RateLimitMiddleware(RateLimitConfigs.USER_CHANNELS),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'pin_direct_message_channel',
			summary: 'Pin direct message channel',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Pins a private message channel for the current user. Pinned channels appear at the top of the channel list for easy access.',
		}),
		async (ctx) => {
			await ctx.get('userChannelRequestService').pinChannel({
				userId: ctx.get('user').id,
				channelId: createChannelID(ctx.req.valid('param').channel_id),
			});
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/users/@me/channels/:channel_id/pin',
		RateLimitMiddleware(RateLimitConfigs.USER_CHANNELS),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'unpin_direct_message_channel',
			summary: 'Unpin direct message channel',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Unpins a private message channel for the current user. The channel will return to its normal position in the channel list based on activity.',
		}),
		async (ctx) => {
			await ctx.get('userChannelRequestService').unpinChannel({
				userId: ctx.get('user').id,
				channelId: createChannelID(ctx.req.valid('param').channel_id),
			});
			return ctx.body(null, 204);
		},
	);
}
