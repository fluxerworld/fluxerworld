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

import {
	createGuild,
	createMessageHarness,
	createTestAccount,
	editMessageWithAttachments,
	ensureSessionStarted,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message edit validation', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createMessageHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('validates message edit with empty content string', async () => {
		const account = await createTestAccount(harness);
		await ensureSessionStarted(harness, account.token);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const msg = await sendMessage(harness, account.token, channelId, 'original content');

		await createBuilder(harness, account.token)
			.patch(`/channels/${channelId}/messages/${msg.id}`)
			.body({
				content: '',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('validates message edit with wrong content type', async () => {
		const account = await createTestAccount(harness);
		await ensureSessionStarted(harness, account.token);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const msg = await sendMessage(harness, account.token, channelId, 'original content');

		await createBuilder(harness, account.token)
			.patch(`/channels/${channelId}/messages/${msg.id}`)
			.body({
				content: 12345,
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('validates message edit with missing content field', async () => {
		const account = await createTestAccount(harness);
		await ensureSessionStarted(harness, account.token);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const msg = await sendMessage(harness, account.token, channelId, 'original content');

		await createBuilder(harness, account.token)
			.patch(`/channels/${channelId}/messages/${msg.id}`)
			.body({})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('validates message edit with overly long content', async () => {
		const account = await createTestAccount(harness);
		await ensureSessionStarted(harness, account.token);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const msg = await sendMessage(harness, account.token, channelId, 'original content');
		const longContent = 'x'.repeat(6000);

		await createBuilder(harness, account.token)
			.patch(`/channels/${channelId}/messages/${msg.id}`)
			.body({
				content: longContent,
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('allows valid message edit', async () => {
		const account = await createTestAccount(harness);
		await ensureSessionStarted(harness, account.token);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const msg = await sendMessage(harness, account.token, channelId, 'original content');

		const edited = await editMessageWithAttachments(harness, account.token, channelId, msg.id, {
			content: 'valid update',
		});

		expect(edited.content).toBe('valid update');
	});
});
