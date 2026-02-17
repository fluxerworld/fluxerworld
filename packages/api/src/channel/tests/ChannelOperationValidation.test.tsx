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
	createChannel,
	createGuild,
	deleteChannel,
	getChannel,
	updateChannel,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Channel Operation Validation', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('should reject getting nonexistent channel', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.get('/channels/999999999999999999')
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should reject updating nonexistent channel', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.patch('/channels/999999999999999999')
			.body({name: 'new-name'})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should reject deleting nonexistent channel', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.delete('/channels/999999999999999999')
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should get channel successfully', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Channel Operation Guild');
		const channel = await getChannel(harness, account.token, guild.system_channel_id!);

		expect(channel.id).toBe(guild.system_channel_id);
	});

	it('should update channel name successfully', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Channel Operation Guild');
		const channelId = guild.system_channel_id!;

		const updated = await updateChannel(harness, account.token, channelId, {name: 'updated-name'});

		expect(updated.name).toBe('updated-name');
	});

	it('should update channel topic successfully', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Channel Operation Guild');
		const channelId = guild.system_channel_id!;

		const updated = await updateChannel(harness, account.token, channelId, {topic: 'New topic'});

		expect(updated.topic).toBe('New topic');
	});

	it('should delete channel successfully', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Channel Operation Guild');

		const newChannel = await createChannel(harness, account.token, guild.id, 'to-delete');

		await deleteChannel(harness, account.token, newChannel.id);

		await createBuilder(harness, account.token)
			.get(`/channels/${newChannel.id}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});
});
