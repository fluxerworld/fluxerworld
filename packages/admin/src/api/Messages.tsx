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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {ApiClient, type ApiResult} from '@fluxer/admin/src/api/Client';
import type {JsonObject} from '@fluxer/admin/src/api/JsonTypes';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {
	DeleteAllUserMessagesResponse,
	MessageShredResponse,
} from '@fluxer/schema/src/domains/admin/AdminMessageSchemas';
import type {
	LookupMessageResponse as LookupMessageResponseSchema,
	MessageShredStatusResponse as MessageShredStatusResponseSchema,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

export type LookupMessageResponse = z.infer<typeof LookupMessageResponseSchema>;
export type MessageShredStatusResponse = z.infer<typeof MessageShredStatusResponseSchema>;

export type ShredEntry = {
	channel_id: string;
	message_id: string;
};

export async function deleteMessage(
	config: Config,
	session: Session,
	channel_id: string,
	message_id: string,
	auditLogReason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid(
		'/admin/messages/delete',
		{
			channel_id,
			message_id,
		},
		auditLogReason,
	);
}

export async function lookupMessage(
	config: Config,
	session: Session,
	channel_id: string,
	message_id: string,
	context_limit: number,
): Promise<ApiResult<LookupMessageResponse>> {
	const client = new ApiClient(config, session);
	return client.post<LookupMessageResponse>('/admin/messages/lookup', {
		channel_id,
		message_id,
		context_limit,
	});
}

export async function queueMessageShred(
	config: Config,
	session: Session,
	user_id: string,
	entries: Array<ShredEntry>,
): Promise<ApiResult<MessageShredResponse>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		user_id,
		entries: entries.map((e) => ({channel_id: e.channel_id, message_id: e.message_id})),
	};
	return client.post<MessageShredResponse>('/admin/messages/shred', body);
}

export async function deleteAllUserMessages(
	config: Config,
	session: Session,
	user_id: string,
	dry_run: boolean,
): Promise<ApiResult<DeleteAllUserMessagesResponse>> {
	const client = new ApiClient(config, session);
	return client.post<DeleteAllUserMessagesResponse>('/admin/messages/delete-all', {
		user_id,
		dry_run,
	});
}

export async function getMessageShredStatus(
	config: Config,
	session: Session,
	job_id: string,
): Promise<ApiResult<MessageShredStatusResponse>> {
	const client = new ApiClient(config, session);
	return client.post<MessageShredStatusResponse>('/admin/messages/shred-status', {
		job_id,
	});
}

export async function lookupMessageByAttachment(
	config: Config,
	session: Session,
	channel_id: string,
	attachment_id: string,
	filename: string,
	context_limit: number,
): Promise<ApiResult<LookupMessageResponse>> {
	const client = new ApiClient(config, session);
	return client.post<LookupMessageResponse>('/admin/messages/lookup-by-attachment', {
		channel_id,
		attachment_id,
		filename,
		context_limit,
	});
}
