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

import {randomUUID} from 'node:crypto';
import type {TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {
	GuildEmojiWithUserResponse,
	GuildStickerWithUserResponse,
} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {GuildRoleResponse} from '@fluxer/schema/src/domains/guild/GuildRoleSchemas';
import type {GuildInviteMetadataResponse} from '@fluxer/schema/src/domains/invite/InviteSchemas';

export const VALID_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export const VALID_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function getPngDataUrl(base64: string = VALID_PNG_BASE64): string {
	return `data:image/png;base64,${base64}`;
}

export function getGifDataUrl(base64: string = VALID_GIF_BASE64): string {
	return `data:image/gif;base64,${base64}`;
}

export function getTooLargePngDataUrl(): string {
	const largeData = 'A'.repeat(384 * 1024 + 1);
	const base64 = Buffer.from(largeData).toString('base64');
	return getPngDataUrl(base64);
}

export function getTooLargeStickerDataUrl(): string {
	const largeData = 'A'.repeat(512 * 1024 + 1);
	const base64 = Buffer.from(largeData).toString('base64');
	return getPngDataUrl(base64);
}

export async function createTestGuild(harness: ApiTestHarness, token: string, name?: string): Promise<GuildResponse> {
	const guildName = name ?? `Test Guild ${randomUUID()}`;
	return createBuilder<GuildResponse>(harness, token).post('/guilds').body({name: guildName}).execute();
}

export async function createTestRole(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	params?: {name?: string; permissions?: string},
): Promise<GuildRoleResponse> {
	return createBuilder<GuildRoleResponse>(harness, token)
		.post(`/guilds/${guildId}/roles`)
		.body({
			name: params?.name ?? 'Test Role',
			permissions: params?.permissions,
		})
		.execute();
}

export async function assignRoleToMember(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	userId: string,
	roleId: string,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.put(`/guilds/${guildId}/members/${userId}/roles/${roleId}`)
		.expect(204)
		.execute();
}

export async function createTestChannel(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	params?: {name?: string; type?: number},
): Promise<ChannelResponse> {
	return createBuilder<ChannelResponse>(harness, token)
		.post(`/guilds/${guildId}/channels`)
		.body({
			name: params?.name ?? 'test-channel',
			type: params?.type ?? 0,
		})
		.execute();
}

export async function createChannelInvite(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
): Promise<GuildInviteMetadataResponse> {
	return createBuilder<GuildInviteMetadataResponse>(harness, token)
		.post(`/channels/${channelId}/invites`)
		.body({})
		.execute();
}

export async function acceptInvite(harness: ApiTestHarness, token: string, inviteCode: string): Promise<void> {
	await createBuilder<void>(harness, token).post(`/invites/${inviteCode}`).body({}).expect(200).execute();
}

export async function createEmoji(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	params: {name: string; image: string},
): Promise<GuildEmojiWithUserResponse> {
	return createBuilder<GuildEmojiWithUserResponse>(harness, token)
		.post(`/guilds/${guildId}/emojis`)
		.body(params)
		.execute();
}

export async function listEmojis(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
): Promise<Array<GuildEmojiWithUserResponse>> {
	return createBuilder<Array<GuildEmojiWithUserResponse>>(harness, token).get(`/guilds/${guildId}/emojis`).execute();
}

export async function updateEmoji(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	emojiId: string,
	params: {name: string},
): Promise<GuildEmojiWithUserResponse> {
	return createBuilder<GuildEmojiWithUserResponse>(harness, token)
		.patch(`/guilds/${guildId}/emojis/${emojiId}`)
		.body(params)
		.execute();
}

export async function deleteEmoji(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	emojiId: string,
): Promise<void> {
	await createBuilder<void>(harness, token).delete(`/guilds/${guildId}/emojis/${emojiId}`).expect(204).execute();
}

export async function createSticker(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	params: {name: string; description?: string; tags?: Array<string>; image: string},
): Promise<GuildStickerWithUserResponse> {
	return createBuilder<GuildStickerWithUserResponse>(harness, token)
		.post(`/guilds/${guildId}/stickers`)
		.body(params)
		.execute();
}

export const PERMISSIONS = {
	CREATE_EXPRESSIONS: 1n << 43n,
	MANAGE_EXPRESSIONS: 1n << 30n,
	DEFAULT_WITHOUT_CREATE: 137439396353n,
};

export async function createGuildWithMember(
	harness: ApiTestHarness,
	owner: TestAccount,
	member: TestAccount,
): Promise<{guild: GuildResponse; channel: ChannelResponse}> {
	const guild = await createTestGuild(harness, owner.token);

	const channel = await createTestChannel(harness, owner.token, guild.id);

	const invite = await createChannelInvite(harness, owner.token, channel.id);

	await acceptInvite(harness, member.token, invite.code);

	return {guild, channel};
}

export async function createDmChannel(
	harness: ApiTestHarness,
	token: string,
	recipientId: string,
): Promise<ChannelResponse> {
	await ensureSessionStarted(harness, token);

	return createBuilder<ChannelResponse>(harness, token)
		.post('/users/@me/channels')
		.body({recipient_id: recipientId})
		.execute();
}

export async function sendTypingIndicator(harness: ApiTestHarness, token: string, channelId: string): Promise<void> {
	await createBuilder<void>(harness, token).post(`/channels/${channelId}/typing`).body({}).expect(204).execute();
}

export async function updateSticker(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	stickerId: string,
	params: {name?: string; description?: string; tags?: Array<string>},
): Promise<GuildStickerWithUserResponse> {
	return createBuilder<GuildStickerWithUserResponse>(harness, token)
		.patch(`/guilds/${guildId}/stickers/${stickerId}`)
		.body(params)
		.execute();
}

export async function deleteSticker(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	stickerId: string,
): Promise<void> {
	await createBuilder<void>(harness, token).delete(`/guilds/${guildId}/stickers/${stickerId}`).expect(204).execute();
}
