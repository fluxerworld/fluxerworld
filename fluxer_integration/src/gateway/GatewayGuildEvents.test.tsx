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

import {createGatewayClient, type GatewayClient} from '@fluxer/integration/gateway/GatewayClient';
import type {TestAccount} from '@fluxer/integration/helpers/AccountHelper';
import {createTestAccount, ensureSessionStarted} from '@fluxer/integration/helpers/AccountHelper';
import {apiClient} from '@fluxer/integration/helpers/ApiClient';
import type {GuildResponse} from '@fluxer/integration/helpers/GuildHelper';
import {createGuild, createTextChannel} from '@fluxer/integration/helpers/GuildHelper';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface ChannelCreate {
	id: string;
	name: string;
	type: number;
	guild_id: string;
}

interface ChannelUpdate {
	id: string;
	name?: string;
	topic?: string;
	guild_id: string;
}

interface ChannelDelete {
	id: string;
	guild_id: string;
}

interface MessageCreate {
	id: string;
	channel_id: string;
	content: string;
	author: {
		id: string;
	};
}

describe('Gateway Guild Events', () => {
	let account: TestAccount;
	let guild: GuildResponse;
	let gateway: GatewayClient | null = null;

	beforeEach(async () => {
		account = await createTestAccount();
		await ensureSessionStarted(account.token);
		guild = await createGuild(account.token, 'Events Test Guild');
	});

	afterEach(() => {
		if (gateway) {
			gateway.close();
			gateway = null;
		}
	});

	test('should receive CHANNEL_CREATE when creating a channel', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		const channelPromise = gateway.waitForEvent('CHANNEL_CREATE', 10000, (data) => {
			const channel = data as ChannelCreate;
			return channel.guild_id === guild.id && channel.name === 'new-channel';
		});

		await createTextChannel(account.token, guild.id, 'new-channel');

		const event = await channelPromise;
		const channel = event.data as ChannelCreate;

		expect(channel.name).toBe('new-channel');
		expect(channel.guild_id).toBe(guild.id);
		expect(channel.type).toBe(0);
	});

	test('should receive CHANNEL_UPDATE when updating a channel', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		const channel = await createTextChannel(account.token, guild.id, 'update-test');

		const updatePromise = gateway.waitForEvent('CHANNEL_UPDATE', 10000, (data) => {
			const update = data as ChannelUpdate;
			return update.id === channel.id;
		});

		await apiClient.patch(
			`/channels/${channel.id}`,
			{
				name: 'updated-channel',
				topic: 'New topic',
			},
			account.token,
		);

		const event = await updatePromise;
		const updated = event.data as ChannelUpdate;

		expect(updated.id).toBe(channel.id);
		expect(updated.name).toBe('updated-channel');
	});

	test('should receive CHANNEL_DELETE when deleting a channel', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		const channel = await createTextChannel(account.token, guild.id, 'delete-test');

		const deletePromise = gateway.waitForEvent('CHANNEL_DELETE', 10000, (data) => {
			const deleted = data as ChannelDelete;
			return deleted.id === channel.id;
		});

		await apiClient.delete(`/channels/${channel.id}`, account.token);

		const event = await deletePromise;
		const deleted = event.data as ChannelDelete;

		expect(deleted.id).toBe(channel.id);
	});

	test('should receive MESSAGE_CREATE when sending a message', async () => {
		gateway = await createGatewayClient(account.token);

		const channel = await createTextChannel(account.token, guild.id, 'message-test');

		const messagePromise = gateway.waitForEvent('MESSAGE_CREATE', 10000, (data) => {
			const msg = data as MessageCreate;
			return msg.channel_id === channel.id && msg.content === 'Hello from integration test';
		});

		await apiClient.post(
			`/channels/${channel.id}/messages`,
			{
				content: 'Hello from integration test',
			},
			account.token,
		);

		const event = await messagePromise;
		const message = event.data as MessageCreate;

		expect(message.content).toBe('Hello from integration test');
		expect(message.channel_id).toBe(channel.id);
		expect(message.author.id).toBe(account.userId);
	});

	test('should receive GUILD_UPDATE when updating guild', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		const updatePromise = gateway.waitForEvent('GUILD_UPDATE', 10000, (data) => {
			const update = data as {id: string; name: string};
			return update.id === guild.id && update.name === 'Updated Guild Name';
		});

		await apiClient.patch(
			`/guilds/${guild.id}`,
			{
				name: 'Updated Guild Name',
			},
			account.token,
		);

		const event = await updatePromise;
		const updated = event.data as {id: string; name: string};

		expect(updated.id).toBe(guild.id);
		expect(updated.name).toBe('Updated Guild Name');
	});
});
