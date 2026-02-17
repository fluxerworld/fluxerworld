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
	addMemberRole,
	createChannel,
	createChannelInvite,
	createGuild,
	createRole,
	getChannel,
	getGuildChannels,
	updateChannelPositions,
} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Guild Channel Positions', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should reorder channels within guild', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		const channel1 = await createChannel(harness, account.token, guild.id, 'channel-1');
		const channel2 = await createChannel(harness, account.token, guild.id, 'channel-2');
		const channel3 = await createChannel(harness, account.token, guild.id, 'channel-3');

		await updateChannelPositions(harness, account.token, guild.id, [
			{id: channel3.id, position: 0},
			{id: channel1.id, position: 1},
			{id: channel2.id, position: 2},
		]);

		const channels = await getGuildChannels(harness, account.token, guild.id);
		const textChannels = channels.filter((c) => c.type === ChannelTypes.GUILD_TEXT);

		expect(textChannels.some((c) => c.id === channel1.id)).toBe(true);
		expect(textChannels.some((c) => c.id === channel2.id)).toBe(true);
		expect(textChannels.some((c) => c.id === channel3.id)).toBe(true);
	});

	test('should move channel to category', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		const category = await createChannel(harness, account.token, guild.id, 'Category', ChannelTypes.GUILD_CATEGORY);
		const textChannel = await createChannel(harness, account.token, guild.id, 'text-channel');

		await updateChannelPositions(harness, account.token, guild.id, [{id: textChannel.id, parent_id: category.id}]);

		const updatedChannel = await getChannel(harness, account.token, textChannel.id);
		expect(updatedChannel.parent_id).toBe(category.id);
	});

	test('should move channel out of category', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		const category = await createChannel(harness, account.token, guild.id, 'Category', ChannelTypes.GUILD_CATEGORY);
		const textChannel = await createChannel(harness, account.token, guild.id, 'text-channel');

		await updateChannelPositions(harness, account.token, guild.id, [{id: textChannel.id, parent_id: category.id}]);

		let updatedChannel = await getChannel(harness, account.token, textChannel.id);
		expect(updatedChannel.parent_id).toBe(category.id);

		await updateChannelPositions(harness, account.token, guild.id, [{id: textChannel.id, parent_id: null}]);

		updatedChannel = await getChannel(harness, account.token, textChannel.id);
		expect(updatedChannel.parent_id).toBeNull();
	});

	test('should require MANAGE_CHANNELS permission to reorder', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		const channel1 = await createChannel(harness, owner.token, guild.id, 'channel-1');
		const channel2 = await createChannel(harness, owner.token, guild.id, 'channel-2');

		await createBuilder(harness, member.token)
			.patch(`/guilds/${guild.id}/channels`)
			.body([
				{id: channel1.id, position: 1},
				{id: channel2.id, position: 0},
			])
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should allow MANAGE_CHANNELS role to reorder channels', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const managerRole = await createRole(harness, owner.token, guild.id, {
			name: 'Channel Manager',
			permissions: Permissions.MANAGE_CHANNELS.toString(),
		});

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		await addMemberRole(harness, owner.token, guild.id, member.userId, managerRole.id);

		const channel1 = await createChannel(harness, owner.token, guild.id, 'channel-1');
		const channel2 = await createChannel(harness, owner.token, guild.id, 'channel-2');

		await updateChannelPositions(harness, member.token, guild.id, [
			{id: channel1.id, position: 1},
			{id: channel2.id, position: 0},
		]);
	});

	test('should reject invalid channel id in position update', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		await createBuilder(harness, account.token)
			.patch(`/guilds/${guild.id}/channels`)
			.body([{id: '999999999999999999', position: 0}])
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should lock permissions when moving to category', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		const category = await createChannel(harness, account.token, guild.id, 'Category', ChannelTypes.GUILD_CATEGORY);
		const textChannel = await createChannel(harness, account.token, guild.id, 'text-channel');

		await updateChannelPositions(harness, account.token, guild.id, [
			{id: textChannel.id, parent_id: category.id, lock_permissions: true},
		]);

		const updatedChannel = await getChannel(harness, account.token, textChannel.id);
		expect(updatedChannel.parent_id).toBe(category.id);
	});

	test('should handle moving multiple channels at once', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		const channel1 = await createChannel(harness, account.token, guild.id, 'channel-1');
		const channel2 = await createChannel(harness, account.token, guild.id, 'channel-2');
		const channel3 = await createChannel(harness, account.token, guild.id, 'channel-3');

		await updateChannelPositions(harness, account.token, guild.id, [
			{id: channel1.id, position: 2},
			{id: channel2.id, position: 0},
			{id: channel3.id, position: 1},
		]);
	});

	test('should reject category as parent of category', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		const category1 = await createChannel(harness, account.token, guild.id, 'Category 1', ChannelTypes.GUILD_CATEGORY);
		const category2 = await createChannel(harness, account.token, guild.id, 'Category 2', ChannelTypes.GUILD_CATEGORY);

		await createBuilder(harness, account.token)
			.patch(`/guilds/${guild.id}/channels`)
			.body([{id: category2.id, parent_id: category1.id}])
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should move a voice channel into a text category with provided position', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		const textCategory = await createChannel(harness, account.token, guild.id, 'Text', ChannelTypes.GUILD_CATEGORY);
		const voiceCategory = await createChannel(harness, account.token, guild.id, 'Voice', ChannelTypes.GUILD_CATEGORY);
		const textChannel = await createChannel(harness, account.token, guild.id, 'general', ChannelTypes.GUILD_TEXT);
		const voiceChannel = await createChannel(harness, account.token, guild.id, 'lounge', ChannelTypes.GUILD_VOICE);

		await updateChannelPositions(harness, account.token, guild.id, [{id: textChannel.id, parent_id: textCategory.id}]);
		await updateChannelPositions(harness, account.token, guild.id, [
			{id: voiceChannel.id, parent_id: voiceCategory.id},
		]);

		await updateChannelPositions(harness, account.token, guild.id, [
			{id: voiceChannel.id, parent_id: textCategory.id, position: 1},
		]);

		const channels = await getGuildChannels(harness, account.token, guild.id);
		const movedVoice = channels.find((channel) => channel.id === voiceChannel.id);
		expect(movedVoice?.parent_id).toBe(textCategory.id);

		const destinationSiblings = channels
			.filter((channel) => channel.parent_id === textCategory.id)
			.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
		expect(destinationSiblings.map((channel) => channel.id)).toEqual([textChannel.id, voiceChannel.id]);
	});

	test('should place moved voice channels after all text siblings', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');

		const textCategory = await createChannel(harness, account.token, guild.id, 'Text', ChannelTypes.GUILD_CATEGORY);
		const voiceCategory = await createChannel(harness, account.token, guild.id, 'Voice', ChannelTypes.GUILD_CATEGORY);
		const textOne = await createChannel(harness, account.token, guild.id, 'one', ChannelTypes.GUILD_TEXT);
		const textTwo = await createChannel(harness, account.token, guild.id, 'two', ChannelTypes.GUILD_TEXT);
		const voiceChannel = await createChannel(harness, account.token, guild.id, 'lounge', ChannelTypes.GUILD_VOICE);

		await updateChannelPositions(harness, account.token, guild.id, [
			{id: textOne.id, parent_id: textCategory.id},
			{id: textTwo.id, parent_id: textCategory.id},
			{id: voiceChannel.id, parent_id: voiceCategory.id},
		]);

		await updateChannelPositions(harness, account.token, guild.id, [
			{id: voiceChannel.id, parent_id: textCategory.id, position: 2},
		]);

		const channels = await getGuildChannels(harness, account.token, guild.id);
		const destinationSiblings = channels
			.filter((channel) => channel.parent_id === textCategory.id)
			.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
		expect(destinationSiblings.map((channel) => channel.id)).toEqual([textOne.id, textTwo.id, voiceChannel.id]);
	});
});
