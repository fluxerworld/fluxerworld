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
} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {ensureSessionStarted, sendMessage} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {
	deleteAccount,
	setPendingDeletionAt,
	triggerDeletionWorker,
	waitForDeletionCompletion,
} from '@fluxer/api/src/user/tests/UserTestUtils';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Account Delete Message Pagination', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('account deletion anonymizes messages beyond chunk size', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Pagination Guild');

		let channelId = guild.system_channel_id;
		if (!channelId) {
			const channel = await createChannel(harness, account.token, guild.id, 'general');
			channelId = channel.id;
		}

		const chunkSize = 100;
		const extraMessages = 5;
		const totalMessages = chunkSize + extraMessages;

		await ensureSessionStarted(harness, account.token);

		for (let i = 0; i < totalMessages; i++) {
			await sendMessage(harness, account.token, channelId, `Message ${i + 1}`);
		}

		const newOwner = await createTestAccount(harness);
		const invite = await createChannelInvite(harness, account.token, channelId);
		await acceptInvite(harness, newOwner.token, invite.code);

		await createBuilder(harness, account.token)
			.post(`/guilds/${guild.id}/transfer-ownership`)
			.body({
				new_owner_id: newOwner.userId,
				password: account.password,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		await deleteAccount(harness, account.token, account.password);

		const past = new Date();
		past.setMinutes(past.getMinutes() - 1);
		await setPendingDeletionAt(harness, account.userId, past);

		await triggerDeletionWorker(harness);
		await waitForDeletionCompletion(harness, account.userId);

		const messages = await createBuilder<Array<MessageResponse>>(harness, newOwner.token)
			.get(`/channels/${channelId}/messages?limit=100`)
			.expect(HTTP_STATUS.OK)
			.execute();

		const anonymizedMessages = messages.filter((message) => message.content.startsWith('Message '));
		expect(anonymizedMessages.length).toBeGreaterThan(0);
		for (const message of anonymizedMessages) {
			expect(message.author.id).not.toBe(account.userId);
			expect(message.author.username).toBe('DeletedUser');
			expect(message.author.discriminator).toBe('0000');
		}

		const countJson = await createBuilderWithoutAuth<{count: number}>(harness)
			.get(`/test/users/${account.userId}/messages/count`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(countJson.count).toBe(0);
	}, 60_000);
});
