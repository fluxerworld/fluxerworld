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
import {parseScheduledMessageInput} from '@fluxer/api/src/channel/controllers/ScheduledMessageParsing';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {ChannelIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {ScheduledMessageResponseSchema} from '@fluxer/schema/src/domains/message/ScheduledMessageSchemas';

export function ScheduledMessageController(app: HonoApp) {
	app.post(
		'/channels/:channel_id/messages/schedule',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGE_CREATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'schedule_message',
			summary: 'Schedule a message to send later',
			description:
				'Schedules a message to be sent at a specified time. Only available for regular user accounts. Requires permission to send messages in the target channel. Message is sent automatically at the scheduled time. Returns the scheduled message object with delivery time.',
			responseSchema: ScheduledMessageResponseSchema,
			statusCode: 201,
			security: ['bearerToken', 'sessionToken'],
			tags: 'Channels',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const scheduledMessageService = ctx.get('scheduledMessageService');

			const {message, scheduledLocalAt, timezone} = await parseScheduledMessageInput({
				ctx,
				user,
				channelId,
			});

			const scheduledMessage = await scheduledMessageService.createScheduledMessage({
				user,
				channelId,
				data: message,
				scheduledLocalAt,
				timezone,
			});

			return ctx.json(scheduledMessage.toResponse(), 201);
		},
	);
}
