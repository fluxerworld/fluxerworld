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

import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {
	DeleteAllUserMessagesRequest,
	DeleteAllUserMessagesResponse,
	DeleteMessageRequest,
	LookupMessageByAttachmentRequest,
	LookupMessageRequest,
	MessageShredRequest,
	MessageShredResponse,
	MessageShredStatusRequest,
} from '@fluxer/schema/src/domains/admin/AdminMessageSchemas';
import {
	DeleteMessageResponse,
	LookupMessageResponse,
	MessageShredStatusResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export function MessageAdminController(app: HonoApp) {
	app.post(
		'/admin/messages/lookup',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_LOOKUP),
		Validator('json', LookupMessageRequest),
		OpenAPI({
			operationId: 'lookup_message',
			summary: 'Look up message details',
			description:
				'Retrieves complete message details including content, attachments, edits, and metadata. Look up by message ID and channel. Requires MESSAGE_LOOKUP permission.',
			responseSchema: LookupMessageResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.lookupMessage(ctx.req.valid('json')));
		},
	);

	app.post(
		'/admin/messages/lookup-by-attachment',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_LOOKUP),
		Validator('json', LookupMessageByAttachmentRequest),
		OpenAPI({
			operationId: 'lookup_message_by_attachment',
			summary: 'Look up message by attachment',
			description:
				'Finds and retrieves message containing a specific attachment by ID. Used to locate messages with sensitive or illegal content. Requires MESSAGE_LOOKUP permission.',
			responseSchema: LookupMessageResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.lookupMessageByAttachment(ctx.req.valid('json')));
		},
	);

	app.post(
		'/admin/messages/delete',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_DELETE),
		Validator('json', DeleteMessageRequest),
		OpenAPI({
			operationId: 'delete_message',
			summary: 'Delete single message',
			description:
				'Deletes a single message permanently. Used for removing inappropriate or harmful content. Logged to audit log. Requires MESSAGE_DELETE permission.',
			responseSchema: DeleteMessageResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.deleteMessage(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/messages/shred',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_SHRED),
		Validator('json', MessageShredRequest),
		OpenAPI({
			operationId: 'queue_message_shred',
			summary: 'Queue message shred operation',
			description:
				'Queues bulk message shredding with attachment deletion. Returns job ID to track progress asynchronously. Used for large-scale content removal. Requires MESSAGE_SHRED permission.',
			responseSchema: MessageShredResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.queueMessageShred(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/messages/delete-all',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_DELETE_ALL),
		Validator('json', DeleteAllUserMessagesRequest),
		OpenAPI({
			operationId: 'delete_all_user_messages',
			summary: 'Delete all user messages',
			description:
				'Deletes all messages from a specific user across all channels. Permanent operation used for account suspension or policy violation. Requires MESSAGE_DELETE_ALL permission.',
			responseSchema: DeleteAllUserMessagesResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.deleteAllUserMessages(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/messages/shred-status',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.MESSAGE_SHRED),
		Validator('json', MessageShredStatusRequest),
		OpenAPI({
			operationId: 'get_message_shred_status',
			summary: 'Get message shred status',
			description:
				'Polls status of a queued message shred operation. Returns progress percentage and whether the job is complete. Requires MESSAGE_SHRED permission.',
			responseSchema: MessageShredStatusResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.getMessageShredStatus(body.job_id));
		},
	);
}
