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

import {createMessageID} from '@fluxer/api/src/BrandedTypes';
import {parseScheduledMessageInput} from '@fluxer/api/src/channel/controllers/ScheduledMessageParsing';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp, HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import {ScheduledMessageIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {ScheduledMessageResponseSchema} from '@fluxer/schema/src/domains/message/ScheduledMessageSchemas';
import type {Context} from 'hono';
import {z} from 'zod';

export function UserScheduledMessageController(app: HonoApp) {
	app.get(
		'/users/@me/scheduled-messages',
		RateLimitMiddleware(RateLimitConfigs.USER_SAVED_MESSAGES_READ),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_scheduled_messages',
			summary: 'List scheduled messages',
			responseSchema: z.array(ScheduledMessageResponseSchema),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves all scheduled messages for the current user. Returns list of messages that are scheduled to be sent at a future date and time.',
		}),
		async (ctx: Context<HonoEnv>) => {
			const userId = ctx.get('user').id;
			const scheduledMessageService = ctx.get('scheduledMessageService');
			const scheduledMessages = await scheduledMessageService.listScheduledMessages(userId);

			return ctx.json(
				scheduledMessages.map((message) => message.toResponse()),
				200,
			);
		},
	);

	app.get(
		'/users/@me/scheduled-messages/:scheduled_message_id',
		RateLimitMiddleware(RateLimitConfigs.USER_SAVED_MESSAGES_READ),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ScheduledMessageIdParam),
		OpenAPI({
			operationId: 'get_scheduled_message',
			summary: 'Get scheduled message',
			responseSchema: ScheduledMessageResponseSchema,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves details of a specific scheduled message by ID. Returns the message content, scheduled send time, and status.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const scheduledMessageId = createMessageID(ctx.req.valid('param').scheduled_message_id);
			const scheduledMessageService = ctx.get('scheduledMessageService');
			const scheduledMessage = await scheduledMessageService.getScheduledMessage(userId, scheduledMessageId);

			if (!scheduledMessage) {
				throw new UnknownMessageError();
			}

			return ctx.json(scheduledMessage.toResponse(), 200);
		},
	);

	app.delete(
		'/users/@me/scheduled-messages/:scheduled_message_id',
		RateLimitMiddleware(RateLimitConfigs.USER_SAVED_MESSAGES_WRITE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ScheduledMessageIdParam),
		OpenAPI({
			operationId: 'cancel_scheduled_message',
			summary: 'Cancel scheduled message',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Cancels and deletes a scheduled message before it is sent. The message will not be delivered if cancelled.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const scheduledMessageId = createMessageID(ctx.req.valid('param').scheduled_message_id);
			const scheduledMessageService = ctx.get('scheduledMessageService');
			await scheduledMessageService.cancelScheduledMessage(userId, scheduledMessageId);
			return ctx.body(null, 204);
		},
	);

	app.patch(
		'/users/@me/scheduled-messages/:scheduled_message_id',
		RateLimitMiddleware(RateLimitConfigs.USER_SAVED_MESSAGES_WRITE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ScheduledMessageIdParam),
		OpenAPI({
			operationId: 'update_scheduled_message',
			summary: 'Update scheduled message',
			responseSchema: ScheduledMessageResponseSchema,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Updates an existing scheduled message before it is sent. Can modify message content, scheduled time, and timezone. Returns updated scheduled message details.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const scheduledMessageService = ctx.get('scheduledMessageService');
			const scheduledMessageId = createMessageID(ctx.req.valid('param').scheduled_message_id);

			const existingMessage = await scheduledMessageService.getScheduledMessage(user.id, scheduledMessageId);
			if (!existingMessage) {
				throw new UnknownMessageError();
			}
			const channelId = existingMessage.channelId;

			const {message, scheduledLocalAt, timezone} = await parseScheduledMessageInput({
				ctx,
				user,
				channelId,
			});

			const scheduledMessage = await scheduledMessageService.updateScheduledMessage({
				user,
				channelId,
				data: message,
				scheduledLocalAt,
				timezone,
				scheduledMessageId,
				existing: existingMessage,
			});

			return ctx.json(scheduledMessage.toResponse(), 200);
		},
	);
}
