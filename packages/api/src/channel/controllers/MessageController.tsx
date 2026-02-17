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

import {createAttachmentID, createChannelID, createMessageID} from '@fluxer/api/src/BrandedTypes';
import type {MessageRequest, MessageUpdateRequest} from '@fluxer/api/src/channel/MessageTypes';
import {parseMultipartMessageData} from '@fluxer/api/src/channel/services/message/MessageRequestParser';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {parseJsonPreservingLargeIntegers} from '@fluxer/api/src/utils/LosslessJsonParser';
import {Validator} from '@fluxer/api/src/Validator';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {
	ChannelIdMessageIdAttachmentIdParam,
	ChannelIdMessageIdParam,
	ChannelIdParam,
} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	BulkDeleteMessagesRequest,
	MessageAckRequest,
	MessageRequestSchema,
	MessagesQuery,
	MessageUpdateRequestSchema,
} from '@fluxer/schema/src/domains/message/MessageRequestSchemas';
import {MessageResponseSchema} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {z} from 'zod';

export function MessageController(app: HonoApp) {
	app.get(
		'/channels/:channel_id/messages',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGES_GET),
		LoginRequired,
		Validator('param', ChannelIdParam),
		Validator('query', MessagesQuery),
		OpenAPI({
			operationId: 'list_messages',
			summary: 'List messages in a channel',
			responseSchema: z.array(MessageResponseSchema),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Retrieves a paginated list of messages from a channel. User must have permission to view the channel. Supports pagination via limit, before, after, and around parameters. Returns messages in reverse chronological order (newest first).',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const {limit, before, after, around} = ctx.req.valid('query');
			const requestCache = ctx.get('requestCache');
			const messageRequestService = ctx.get('messageRequestService');
			return ctx.json(
				await messageRequestService.listMessages({
					userId,
					channelId,
					query: {
						limit,
						before: before ? createMessageID(before) : undefined,
						after: after ? createMessageID(after) : undefined,
						around: around ? createMessageID(around) : undefined,
					},
					requestCache,
				}),
			);
		},
	);

	app.get(
		'/channels/:channel_id/messages/:message_id',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGE_GET),
		LoginRequired,
		Validator('param', ChannelIdMessageIdParam),
		OpenAPI({
			operationId: 'get_message',
			summary: 'Fetch a message',
			responseSchema: MessageResponseSchema,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Retrieves a specific message by ID. User must have permission to view the channel and the message must exist. Returns full message details including content, author, reactions, and attachments.',
		}),
		async (ctx) => {
			const {channel_id, message_id} = ctx.req.valid('param');
			const user = ctx.get('user');
			const userId = user.id;
			const channelId = createChannelID(channel_id);
			const messageId = createMessageID(message_id);
			const requestCache = ctx.get('requestCache');
			const messageRequestService = ctx.get('messageRequestService');
			return ctx.json(
				await messageRequestService.getMessage({
					userId,
					channelId,
					messageId,
					requestCache,
				}),
			);
		},
	);

	app.post(
		'/channels/:channel_id/messages',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGE_CREATE),
		LoginRequired,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'send_message',
			summary: 'Send a message',
			responseSchema: MessageResponseSchema,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Sends a new message to a channel. Requires permission to send messages in the target channel. Supports text content, embeds, attachments (multipart), and mentions. Returns the created message object with full details.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const requestCache = ctx.get('requestCache');
			const messageRequestService = ctx.get('messageRequestService');

			const contentType = ctx.req.header('content-type');
			const validatedData = contentType?.includes('multipart/form-data')
				? ((await parseMultipartMessageData(ctx, user, channelId, MessageRequestSchema)) as MessageRequest)
				: await (async () => {
						let data: unknown;
						try {
							const raw = await ctx.req.text();
							data = raw.trim().length === 0 ? {} : parseJsonPreservingLargeIntegers(raw);
						} catch {
							throw InputValidationError.fromCode('message_data', ValidationErrorCodes.INVALID_MESSAGE_DATA);
						}
						const validationResult = MessageRequestSchema.safeParse(data);
						if (!validationResult.success) {
							throw InputValidationError.fromCode('message_data', ValidationErrorCodes.INVALID_MESSAGE_DATA);
						}
						return validationResult.data;
					})();
			return ctx.json(
				await messageRequestService.sendMessage({
					user,
					channelId,
					data: validatedData as MessageRequest,
					requestCache,
				}),
			);
		},
	);

	app.patch(
		'/channels/:channel_id/messages/:message_id',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGE_UPDATE),
		LoginRequired,
		Validator('param', ChannelIdMessageIdParam),
		OpenAPI({
			operationId: 'edit_message',
			summary: 'Edit a message',
			responseSchema: MessageResponseSchema,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Updates an existing message. Only the message author can edit messages (or admins with proper permissions). Supports updating content, embeds, and attachments. Returns the updated message object. Maintains original message ID and timestamps.',
		}),
		async (ctx) => {
			const {channel_id, message_id} = ctx.req.valid('param');
			const user = ctx.get('user');
			const userId = user.id;
			const channelId = createChannelID(channel_id);
			const messageId = createMessageID(message_id);
			const requestCache = ctx.get('requestCache');
			const messageRequestService = ctx.get('messageRequestService');

			const contentType = ctx.req.header('content-type');
			const validatedData = contentType?.includes('multipart/form-data')
				? ((await parseMultipartMessageData(ctx, user, channelId, MessageUpdateRequestSchema)) as MessageUpdateRequest)
				: await (async () => {
						let data: unknown;
						try {
							const raw = await ctx.req.text();
							data = raw.trim().length === 0 ? {} : parseJsonPreservingLargeIntegers(raw);
						} catch {
							throw InputValidationError.fromCode('message_data', ValidationErrorCodes.INVALID_MESSAGE_DATA);
						}
						const validationResult = MessageUpdateRequestSchema.safeParse(data);
						if (!validationResult.success) {
							throw InputValidationError.fromCode('message_data', ValidationErrorCodes.INVALID_MESSAGE_DATA);
						}
						return validationResult.data;
					})();
			return ctx.json(
				await messageRequestService.editMessage({
					userId,
					channelId,
					messageId,
					data: validatedData as MessageUpdateRequest,
					requestCache,
				}),
			);
		},
	);

	app.delete(
		'/channels/:channel_id/messages/ack',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_READ_STATE_DELETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'clear_channel_read_state',
			summary: 'Clear channel read state',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Clears all read state and acknowledgement records for a channel, marking all messages as unread. Only available for regular user accounts. Returns 204 No Content on success.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			await ctx.get('channelService').deleteReadState({userId, channelId});
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/channels/:channel_id/messages/:message_id',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGE_DELETE),
		LoginRequired,
		Validator('param', ChannelIdMessageIdParam),
		OpenAPI({
			operationId: 'delete_message',
			summary: 'Delete a message',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Deletes a message permanently. Only the message author can delete messages (or admins/moderators with proper permissions). Cannot be undone. Returns 204 No Content on success.',
		}),
		async (ctx) => {
			const {channel_id, message_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const channelId = createChannelID(channel_id);
			const messageId = createMessageID(message_id);
			const requestCache = ctx.get('requestCache');
			await ctx.get('channelService').deleteMessage({userId, channelId, messageId, requestCache});
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/channels/:channel_id/messages/:message_id/attachments/:attachment_id',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGE_DELETE),
		LoginRequired,
		Validator('param', ChannelIdMessageIdAttachmentIdParam),
		OpenAPI({
			operationId: 'delete_message_attachment',
			summary: 'Delete a message attachment',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Removes a specific attachment from a message while keeping the message intact. Only the message author can remove attachments (or admins/moderators). Returns 204 No Content on success.',
		}),
		async (ctx) => {
			const {channel_id, message_id, attachment_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const channelId = createChannelID(channel_id);
			const messageId = createMessageID(message_id);
			const attachmentId = createAttachmentID(attachment_id);
			const requestCache = ctx.get('requestCache');
			await ctx.get('channelService').deleteAttachment({
				userId,
				channelId,
				messageId: messageId,
				attachmentId,
				requestCache,
			});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/channels/:channel_id/messages/bulk-delete',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGE_BULK_DELETE),
		LoginRequired,
		Validator('param', ChannelIdParam),
		Validator('json', BulkDeleteMessagesRequest),
		OpenAPI({
			operationId: 'bulk_delete_messages',
			summary: 'Bulk delete messages',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Deletes multiple messages at once. Requires moderation or admin permissions. Commonly used for message cleanup. Messages from different authors can be deleted together. Returns 204 No Content on success.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const messageIds = ctx.req.valid('json').message_ids.map(createMessageID);
			await ctx.get('channelService').bulkDeleteMessages({userId, channelId, messageIds});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/channels/:channel_id/typing',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_TYPING),
		LoginRequired,
		Validator('param', ChannelIdParam),
		OpenAPI({
			operationId: 'indicate_typing',
			summary: 'Indicate typing activity',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Notifies other users in the channel that you are actively typing. Typing indicators typically expire after a short period (usually 10 seconds). Returns 204 No Content. Commonly called repeatedly while the user is composing a message.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			await ctx.get('channelService').startTyping({userId, channelId});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/channels/:channel_id/messages/:message_id/ack',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_MESSAGE_ACK),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdMessageIdParam),
		Validator('json', MessageAckRequest),
		OpenAPI({
			operationId: 'acknowledge_message',
			summary: 'Acknowledge a message',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Channels', 'Messages'],
			description:
				'Marks a message as read and records acknowledgement state. Only available for regular user accounts. Updates mention count if provided. Returns 204 No Content on success.',
		}),
		async (ctx) => {
			const {channel_id, message_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const channelId = createChannelID(channel_id);
			const messageId = createMessageID(message_id);
			const {mention_count: mentionCount, manual} = ctx.req.valid('json');
			await ctx.get('channelService').ackMessage({
				userId,
				channelId,
				messageId,
				mentionCount: mentionCount ?? 0,
				manual,
			});
			return ctx.body(null, 204);
		},
	);
}
