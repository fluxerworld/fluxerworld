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

import {createTestAccount as authCreateTestAccount, type TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

export interface AckResponse {
	token: string;
}

export async function createTestAccount(harness: ApiTestHarness): Promise<TestAccount> {
	return authCreateTestAccount(harness);
}

export async function createMessageHarness(): Promise<ApiTestHarness> {
	const {createApiTestHarness} = await import('@fluxer/api/src/test/ApiTestHarness');
	return await createApiTestHarness();
}

export async function sendMessage(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	content: string,
): Promise<MessageResponse> {
	await ensureSessionStarted(harness, token);

	const msg = await createBuilder<MessageResponse>(harness, token)
		.post(`/channels/${channelId}/messages`)
		.body({
			content,
		})
		.execute();

	if (!msg.id) {
		throw new Error('Message response missing id');
	}
	return msg;
}

export async function getMessage(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
): Promise<MessageResponse> {
	const msg = await createBuilder<MessageResponse>(harness, token)
		.get(`/channels/${channelId}/messages/${messageId}`)
		.execute();

	if (!msg.id) {
		throw new Error('Message response missing id');
	}
	return msg;
}

export async function getMessages(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	queryParams?: Record<string, string>,
): Promise<Array<MessageResponse>> {
	const queryString = queryParams
		? `?${new URLSearchParams(Object.entries(queryParams).map(([k, v]) => [k, v] as [string, string])).toString()}`
		: '';

	return createBuilder<Array<MessageResponse>>(harness, token)
		.get(`/channels/${channelId}/messages${queryString}`)
		.execute();
}

export async function editMessage(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
	content: string,
): Promise<MessageResponse> {
	const msg = await createBuilder<MessageResponse>(harness, token)
		.patch(`/channels/${channelId}/messages/${messageId}`)
		.body({
			content,
		})
		.execute();

	if (!msg.id) {
		throw new Error('Message response missing id');
	}
	return msg;
}

export async function deleteMessage(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.delete(`/channels/${channelId}/messages/${messageId}`)
		.expect(204)
		.execute();
}

export async function ackMessage(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
	mentionCount = 0,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.post(`/channels/${channelId}/messages/${messageId}/ack`)
		.body({
			mention_count: mentionCount,
		})
		.expect(204)
		.execute();
}

export async function pinMessage(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.put(`/channels/${channelId}/pins/${messageId}`)
		.body(null)
		.expect(204)
		.execute();
}

export async function unpinMessage(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
): Promise<void> {
	await createBuilder<void>(harness, token).delete(`/channels/${channelId}/pins/${messageId}`).expect(204).execute();
}

export async function getPins(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
): Promise<Array<MessageResponse>> {
	const result = await createBuilder<{items: Array<{message: MessageResponse; pinned_at: string}>; has_more: boolean}>(
		harness,
		token,
	)
		.get(`/channels/${channelId}/messages/pins`)
		.execute();
	return result.items.map((item) => item.message);
}

export async function createGuild(harness: ApiTestHarness, token: string, name: string): Promise<GuildResponse> {
	const guild = await createBuilder<GuildResponse>(harness, token)
		.post('/guilds')
		.body({
			name,
		})
		.execute();

	if (!guild.id) {
		throw new Error('Guild response missing id');
	}
	return guild;
}

export async function createDMChannel(
	harness: ApiTestHarness,
	token: string,
	recipientUserId: string,
): Promise<MessageResponse> {
	const channel = await createBuilder<MessageResponse>(harness, token)
		.post('/users/@me/channels')
		.body({
			recipient_id: recipientUserId,
		})
		.execute();

	if (!channel.id) {
		throw new Error('Channel response missing id');
	}
	return channel;
}

export async function createChannelInvite(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
): Promise<{code: string}> {
	return createBuilder<{code: string}>(harness, token).post(`/channels/${channelId}/invites`).body({}).execute();
}

export async function acceptInvite(harness: ApiTestHarness, token: string, inviteCode: string): Promise<void> {
	await createBuilder<void>(harness, token).post(`/invites/${inviteCode}`).body({}).expect(200).execute();
}

export async function addReaction(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
	emoji: string,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.put(`/channels/${channelId}/messages/${messageId}/reactions/${emoji}/@me`)
		.body(null)
		.expect(204)
		.execute();
}

export async function removeReaction(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
	emoji: string,
	userId?: string,
): Promise<void> {
	const user = userId ?? '@me';
	await createBuilder<void>(harness, token)
		.delete(`/channels/${channelId}/messages/${messageId}/reactions/${emoji}/${user}`)
		.expect(204)
		.execute();
}

export async function removeAllReactions(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.delete(`/channels/${channelId}/messages/${messageId}/reactions`)
		.expect(204)
		.execute();
}

export async function removeAllReactionsForEmoji(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
	emoji: string,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.delete(`/channels/${channelId}/messages/${messageId}/reactions/${emoji}`)
		.expect(204)
		.execute();
}

export async function deleteAttachment(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
	attachmentId: string,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.delete(`/channels/${channelId}/messages/${messageId}/attachments/${attachmentId}`)
		.body(null)
		.expect(204)
		.execute();
}

export async function updateChannelPermissions(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	overwriteId: string,
	overwrite: {
		type: number;
		allow?: string;
		deny?: string;
	},
): Promise<void> {
	await createBuilder<void>(harness, token)
		.put(`/channels/${channelId}/permissions/${overwriteId}`)
		.body(overwrite)
		.expect(204)
		.execute();
}

export async function editMessageWithAttachments(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	messageId: string,
	updates: {
		content?: string;
		attachments?: Array<Record<string, unknown>>;
		embeds?: Array<Record<string, unknown>>;
		flags?: number;
	},
): Promise<MessageResponse> {
	const msg = await createBuilder<MessageResponse>(harness, token)
		.patch(`/channels/${channelId}/messages/${messageId}`)
		.body(updates)
		.execute();

	if (!msg.id) {
		throw new Error('Message response missing id');
	}
	return msg;
}

export async function createFriendship(harness: ApiTestHarness, user1: TestAccount, user2: TestAccount): Promise<void> {
	await createBuilder<unknown>(harness, user1.token)
		.post(`/users/@me/relationships/${user2.userId}`)
		.body({})
		.execute();

	await createBuilder<unknown>(harness, user2.token).put(`/users/@me/relationships/${user1.userId}`).body({}).execute();
}

export async function ensureSessionStarted(harness: ApiTestHarness, token: string): Promise<void> {
	const me = await createBuilder<{id: string; flags?: string | number}>(harness, token).get('/users/@me').execute();

	const HAS_SESSION_STARTED = BigInt(1) << BigInt(39);
	const currentFlags = BigInt(me.flags ?? 0);

	if ((currentFlags & HAS_SESSION_STARTED) !== BigInt(0)) {
		return;
	}

	await createBuilder<unknown>(harness, token)
		.patch(`/test/users/${me.id}/flags`)
		.body({
			flags: (currentFlags | HAS_SESSION_STARTED).toString(),
		})
		.execute();
}

export interface SeedMessageInput {
	message_id?: string;
	timestamp?: string;
	content?: string;
	author_id?: string;
}

export interface SeededMessage {
	message_id: string;
	bucket: number;
	timestamp: string;
}

export interface SeedMessagesResult {
	messages: Array<SeededMessage>;
	buckets_populated: Array<number>;
	channel_state_updated: boolean;
}

export async function seedMessages(
	harness: ApiTestHarness,
	channelId: string,
	messages: Array<SeedMessageInput>,
	options?: {
		authorId?: string;
		clearExisting?: boolean;
		skipBucketIndex?: boolean;
	},
): Promise<SeedMessagesResult> {
	return createBuilder<SeedMessagesResult>(harness, '')
		.post('/test/messages/seed')
		.body({
			channel_id: channelId,
			messages,
			author_id: options?.authorId,
			clear_existing: options?.clearExisting ?? false,
			skip_bucket_index: options?.skipBucketIndex ?? false,
		})
		.execute();
}

export async function seedMessagesWithContent(
	harness: ApiTestHarness,
	channelId: string,
	count: number,
	authorId: string,
): Promise<SeedMessagesResult> {
	const messages: Array<SeedMessageInput> = [];
	const baseTime = Date.now() - 3600000;
	for (let i = 0; i < count; i++) {
		messages.push({
			timestamp: new Date(baseTime + i * 1000).toISOString(),
			content: `Test message ${i + 1}`,
		});
	}
	return seedMessages(harness, channelId, messages, {authorId, clearExisting: true});
}

export async function seedMessagesAtTimestamps(
	harness: ApiTestHarness,
	channelId: string,
	timestamps: Array<Date>,
	authorId: string,
): Promise<SeedMessagesResult> {
	const messages: Array<SeedMessageInput> = timestamps.map((ts, i) => ({
		timestamp: ts.toISOString(),
		content: `Test message ${i + 1}`,
	}));
	return seedMessages(harness, channelId, messages, {authorId, clearExisting: true});
}

export interface ChannelStateResponse {
	channel_id: string;
	exists: boolean;
	created_bucket?: number;
	has_messages?: boolean;
	last_message_id?: string | null;
	last_message_bucket?: number | null;
	updated_at?: string;
}

export async function getChannelState(harness: ApiTestHarness, channelId: string): Promise<ChannelStateResponse> {
	return createBuilder<ChannelStateResponse>(harness, '').get(`/test/channels/${channelId}/state`).execute();
}

export interface ChannelBucket {
	bucket: number;
	updated_at: string;
}

export interface ChannelBucketsResponse {
	channel_id: string;
	buckets: Array<ChannelBucket>;
	count: number;
}

export async function getChannelBuckets(harness: ApiTestHarness, channelId: string): Promise<ChannelBucketsResponse> {
	return createBuilder<ChannelBucketsResponse>(harness, '').get(`/test/channels/${channelId}/buckets`).execute();
}

export async function clearChannelMessages(harness: ApiTestHarness, channelId: string): Promise<void> {
	await createBuilder<{channel_id: string; cleared: boolean}>(harness, '')
		.delete(`/test/channels/${channelId}/messages`)
		.execute();
}

export async function markChannelAsIndexed(harness: ApiTestHarness, channelId: string): Promise<void> {
	await createBuilder<{channel_id: string; indexed_at: string}>(harness, '')
		.post(`/test/channels/${channelId}/mark-indexed`)
		.body({})
		.execute();
}

export async function markGuildChannelsAsIndexed(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
): Promise<void> {
	const channels = await createBuilder<Array<{id: string}>>(harness, token)
		.get(`/guilds/${guildId}/channels`)
		.execute();

	await Promise.all(channels.map((channel) => markChannelAsIndexed(harness, channel.id)));
}

export async function markUserDmChannelsAsIndexed(harness: ApiTestHarness, token: string): Promise<void> {
	const channels = await createBuilder<Array<{id: string}>>(harness, token).get('/users/@me/channels').execute();

	await Promise.all(channels.map((channel) => markChannelAsIndexed(harness, channel.id)));
}
