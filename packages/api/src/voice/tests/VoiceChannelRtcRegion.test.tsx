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
import {createChannel, createGuild, getChannel} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Voice Channel RTC Region', () => {
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

	it('voice channel has null rtc_region by default', async () => {
		const owner = await createTestAccount(harness);
		await ensureSessionStarted(harness, owner.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'voice-test', ChannelTypes.GUILD_VOICE);

		expect(voiceChannel.rtc_region).toBeNull();
	});

	it('owner can set rtc_region on voice channel', async () => {
		const owner = await createTestAccount(harness);
		await ensureSessionStarted(harness, owner.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'voice-test', ChannelTypes.GUILD_VOICE);

		const updated = await createBuilder<ChannelResponse>(harness, owner.token)
			.patch(`/channels/${voiceChannel.id}`)
			.body({rtc_region: 'us-west'})
			.execute();

		expect(updated.rtc_region).toBe('us-west');
	});

	it('owner can clear rtc_region to null', async () => {
		const owner = await createTestAccount(harness);
		await ensureSessionStarted(harness, owner.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'voice-test', ChannelTypes.GUILD_VOICE);

		await createBuilder<ChannelResponse>(harness, owner.token)
			.patch(`/channels/${voiceChannel.id}`)
			.body({rtc_region: 'us-west'})
			.execute();

		const updated = await createBuilder<ChannelResponse>(harness, owner.token)
			.patch(`/channels/${voiceChannel.id}`)
			.body({rtc_region: null})
			.execute();

		expect(updated.rtc_region).toBeNull();
	});

	it('rtc_region persists after fetch', async () => {
		const owner = await createTestAccount(harness);
		await ensureSessionStarted(harness, owner.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'voice-test', ChannelTypes.GUILD_VOICE);

		await createBuilder<ChannelResponse>(harness, owner.token)
			.patch(`/channels/${voiceChannel.id}`)
			.body({rtc_region: 'eu-west'})
			.execute();

		const fetched = await getChannel(harness, owner.token, voiceChannel.id);

		expect(fetched.rtc_region).toBe('eu-west');
	});

	it('voice channel bitrate is set during creation', async () => {
		const owner = await createTestAccount(harness);
		await ensureSessionStarted(harness, owner.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'voice-test', ChannelTypes.GUILD_VOICE);

		expect(voiceChannel.bitrate).toBeDefined();
		expect(typeof voiceChannel.bitrate).toBe('number');
	});

	it('voice channel user_limit defaults to 0', async () => {
		const owner = await createTestAccount(harness);
		await ensureSessionStarted(harness, owner.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const voiceChannel = await createChannel(harness, owner.token, guild.id, 'voice-test', ChannelTypes.GUILD_VOICE);

		expect(voiceChannel.user_limit).toBe(0);
	});
});
