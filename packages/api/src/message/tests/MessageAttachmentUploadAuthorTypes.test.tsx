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
import {authorizeBot, createTestBotAccount} from '@fluxer/api/src/bot/tests/BotTestUtils';
import {
	createChannel,
	createGuild,
	loadFixture,
	sendMessageWithAttachments,
} from '@fluxer/api/src/channel/tests/AttachmentTestUtils';
import {ensureSessionStarted, updateChannelPermissions} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message attachment upload by author type', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('uploads attachment-only messages as a user', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'User attachment uploads guild');
		const channel = await createChannel(harness, account.token, guild.id, 'uploads');
		const channelId = guild.system_channel_id ?? channel.id;

		const {response, json} = await sendMessageWithAttachments(
			harness,
			account.token,
			channelId,
			{
				attachments: [{id: 0, filename: 'user_upload.png'}],
			},
			[{index: 0, filename: 'user_upload.png', data: loadFixture('yeah.png')}],
		);

		expect(response.status).toBe(HTTP_STATUS.OK);
		expect(json.attachments).toBeDefined();
		expect(json.attachments).not.toBeNull();
		expect(json.attachments!).toHaveLength(1);
		expect(json.attachments![0].filename).toBe('user_upload.png');
	});

	it('uploads attachment-only messages as a bot with attach permissions', async () => {
		const botAccount = await createTestBotAccount(harness);
		await ensureSessionStarted(harness, botAccount.ownerToken);

		const guild = await createGuild(harness, botAccount.ownerToken, 'Bot attachment uploads guild');
		const channel = await createChannel(harness, botAccount.ownerToken, guild.id, 'uploads');
		const channelId = guild.system_channel_id ?? channel.id;

		const botPermissions = (
			Permissions.VIEW_CHANNEL |
			Permissions.SEND_MESSAGES |
			Permissions.READ_MESSAGE_HISTORY |
			Permissions.ATTACH_FILES
		).toString();

		await authorizeBot(harness, botAccount.ownerToken, botAccount.appId, ['bot'], guild.id, botPermissions);

		const botToken = `Bot ${botAccount.botToken}`;
		await ensureSessionStarted(harness, botToken);

		const {response, json} = await sendMessageWithAttachments(
			harness,
			botToken,
			channelId,
			{
				attachments: [{id: 0, filename: 'bot_upload.png'}],
			},
			[{index: 0, filename: 'bot_upload.png', data: loadFixture('yeah.png')}],
		);

		expect(response.status).toBe(HTTP_STATUS.OK);
		expect(json.attachments).toBeDefined();
		expect(json.attachments).not.toBeNull();
		expect(json.attachments!).toHaveLength(1);
		expect(json.attachments![0].filename).toBe('bot_upload.png');
	});

	it('rejects bot uploads without attach permissions', async () => {
		const botAccount = await createTestBotAccount(harness);
		await ensureSessionStarted(harness, botAccount.ownerToken);

		const guild = await createGuild(harness, botAccount.ownerToken, 'Bot attachment permission checks guild');
		const channel = await createChannel(harness, botAccount.ownerToken, guild.id, 'uploads');
		const channelId = guild.system_channel_id ?? channel.id;

		const botPermissions = (
			Permissions.VIEW_CHANNEL |
			Permissions.SEND_MESSAGES |
			Permissions.READ_MESSAGE_HISTORY
		).toString();

		await authorizeBot(harness, botAccount.ownerToken, botAccount.appId, ['bot'], guild.id, botPermissions);

		const botToken = `Bot ${botAccount.botToken}`;
		await ensureSessionStarted(harness, botToken);
		await updateChannelPermissions(harness, botAccount.ownerToken, channelId, botAccount.botUserId, {
			type: 1,
			allow: (Permissions.VIEW_CHANNEL | Permissions.SEND_MESSAGES | Permissions.READ_MESSAGE_HISTORY).toString(),
			deny: Permissions.ATTACH_FILES.toString(),
		});

		const {response} = await sendMessageWithAttachments(
			harness,
			botToken,
			channelId,
			{
				attachments: [{id: 0, filename: 'blocked_bot_upload.png'}],
			},
			[{index: 0, filename: 'blocked_bot_upload.png', data: loadFixture('yeah.png')}],
		);

		expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
	});
});
