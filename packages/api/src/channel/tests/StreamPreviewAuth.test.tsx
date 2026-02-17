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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	acceptInvite,
	createChannel,
	createChannelInvite,
	createGuild,
	createPermissionOverwrite,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const STREAM_PREVIEW_BASE64 = 'dGVzdC1zdHJlYW0tcHJldmlldw==';
const STREAM_PREVIEW_TEXT = 'test-stream-preview';

function createGuildStreamKey(guildId: string, channelId: string): string {
	return `${guildId}:${channelId}:test-connection`;
}

function createStreamPreviewPath(streamKey: string): string {
	return `/streams/${streamKey}/preview`;
}

async function uploadStreamPreview(
	harness: ApiTestHarness,
	token: string,
	streamKey: string,
	channelId: string,
): Promise<void> {
	await createBuilder(harness, token)
		.post(createStreamPreviewPath(streamKey))
		.body({
			channel_id: channelId,
			thumbnail: STREAM_PREVIEW_BASE64,
			content_type: 'image/jpeg',
		})
		.expect(HTTP_STATUS.NO_CONTENT)
		.execute();
}

describe('Stream preview auth', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('allows preview access for a guild member with CONNECT permission', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'stream-voice', ChannelTypes.GUILD_VOICE);
		const streamKey = createGuildStreamKey(guild.id, voiceChannel.id);

		const invite = await createChannelInvite(harness, owner.token, guild.system_channel_id!);
		await acceptInvite(harness, member.token, invite.code);

		await createPermissionOverwrite(harness, owner.token, voiceChannel.id, member.userId, {
			type: 1,
			allow: Permissions.CONNECT.toString(),
			deny: '0',
		});

		await uploadStreamPreview(harness, owner.token, streamKey, voiceChannel.id);

		const {response, text} = await createBuilder(harness, member.token)
			.get(createStreamPreviewPath(streamKey))
			.expect(HTTP_STATUS.OK)
			.executeRaw();

		expect(response.headers.get('content-type')).toBe('image/jpeg');
		expect(text).toBe(STREAM_PREVIEW_TEXT);
	});

	it('rejects preview access for a user outside the guild', async () => {
		const owner = await createTestAccount(harness);
		const outsider = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'stream-voice', ChannelTypes.GUILD_VOICE);
		const streamKey = createGuildStreamKey(guild.id, voiceChannel.id);

		await uploadStreamPreview(harness, owner.token, streamKey, voiceChannel.id);

		await createBuilder(harness, outsider.token)
			.get(createStreamPreviewPath(streamKey))
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.ACCESS_DENIED)
			.execute();
	});

	it('rejects preview access when CONNECT is denied in the stream channel', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'stream-voice', ChannelTypes.GUILD_VOICE);
		const streamKey = createGuildStreamKey(guild.id, voiceChannel.id);

		const invite = await createChannelInvite(harness, owner.token, guild.system_channel_id!);
		await acceptInvite(harness, member.token, invite.code);

		await createPermissionOverwrite(harness, owner.token, voiceChannel.id, member.userId, {
			type: 1,
			allow: '0',
			deny: Permissions.CONNECT.toString(),
		});

		await uploadStreamPreview(harness, owner.token, streamKey, voiceChannel.id);

		await createBuilder(harness, member.token)
			.get(createStreamPreviewPath(streamKey))
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_PERMISSIONS)
			.execute();
	});
});
