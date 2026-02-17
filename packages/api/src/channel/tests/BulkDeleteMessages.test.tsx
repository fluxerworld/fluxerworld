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
import {createGuild} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Bulk Delete Messages', () => {
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

	it('rejects empty message_ids array', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Validation Test Guild');

		if (!guild.system_channel_id) {
			throw new Error('Guild should have a system channel');
		}

		await createBuilder(harness, owner.token)
			.post(`/channels/${guild.system_channel_id}/messages/bulk-delete`)
			.body({message_ids: []})
			.expect(400)
			.execute();
	});

	it('rejects more than 100 messages', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Validation Test Guild');

		if (!guild.system_channel_id) {
			throw new Error('Guild should have a system channel');
		}

		const tooManyIds: Array<string> = [];
		for (let i = 0; i < 101; i++) {
			tooManyIds.push(`${1000000000000000000n + BigInt(i)}`);
		}

		await createBuilder(harness, owner.token)
			.post(`/channels/${guild.system_channel_id}/messages/bulk-delete`)
			.body({message_ids: tooManyIds})
			.expect(400)
			.execute();
	});

	it('rejects bulk delete without MANAGE_MESSAGES permission when channel does not exist', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Permissions Test Guild');

		if (!guild.system_channel_id) {
			throw new Error('Guild should have a system channel');
		}

		const messageIds: Array<string> = [];
		for (let i = 0; i < 3; i++) {
			messageIds.push(`${1000000000000000000n + BigInt(i)}`);
		}

		await createBuilder(harness, member.token)
			.post(`/channels/${guild.system_channel_id}/messages/bulk-delete`)
			.body({message_ids: messageIds})
			.expect(403)
			.execute();
	});

	it('accepts bulk delete request with valid message IDs (does not require messages to exist)', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Bulk Delete Test Guild');

		if (!guild.system_channel_id) {
			throw new Error('Guild should have a system channel');
		}

		const messageIds: Array<string> = [];
		for (let i = 0; i < 5; i++) {
			messageIds.push(`${1000000000000000000n + BigInt(i)}`);
		}

		await createBuilder(harness, owner.token)
			.post(`/channels/${guild.system_channel_id}/messages/bulk-delete`)
			.body({message_ids: messageIds})
			.expect(204)
			.execute();
	});
});
