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
import type {VoiceStateUpdate} from '@fluxer/integration/gateway/GatewayTypes';
import type {TestAccount} from '@fluxer/integration/helpers/AccountHelper';
import {createTestAccount, ensureSessionStarted} from '@fluxer/integration/helpers/AccountHelper';
import type {ChannelResponse, GuildResponse} from '@fluxer/integration/helpers/GuildHelper';
import {createGuild, createVoiceChannel} from '@fluxer/integration/helpers/GuildHelper';
import {confirmVoiceConnectionForTest} from '@fluxer/integration/helpers/VoiceHelper';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Gateway Voice State', () => {
	let account: TestAccount;
	let guild: GuildResponse;
	let voiceChannel: ChannelResponse;
	let gateway: GatewayClient | null = null;

	beforeEach(async () => {
		account = await createTestAccount();
		await ensureSessionStarted(account.token);

		guild = await createGuild(account.token, 'Voice Test Guild');
		voiceChannel = await createVoiceChannel(account.token, guild.id, 'test-voice');
	});

	afterEach(() => {
		if (gateway) {
			gateway.close();
			gateway = null;
		}
	});

	test('should join guild voice channel and receive VOICE_SERVER_UPDATE', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		gateway.sendVoiceStateUpdate(guild.id, voiceChannel.id, null, false, false, false, false);

		const serverUpdate = await gateway.waitForVoiceServerUpdate(10000);

		expect(serverUpdate.token).toBeTruthy();
		expect(serverUpdate.endpoint).toBeTruthy();
		expect(serverUpdate.guild_id).toBe(guild.id);
		expect(serverUpdate.connection_id).toBeTruthy();
	});

	test('should receive VOICE_STATE_UPDATE when joining voice channel', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		gateway.sendVoiceStateUpdate(guild.id, voiceChannel.id, null, false, false, false, false);
		const serverUpdate = await gateway.waitForVoiceServerUpdate(10000);
		await confirmVoiceConnectionForTest({
			guildId: guild.id,
			channelId: voiceChannel.id,
			connectionId: serverUpdate.connection_id,
		});

		const stateUpdate = await gateway.waitForVoiceStateUpdate(10000, (vs: VoiceStateUpdate) => {
			return (
				vs.user_id === account.userId &&
				vs.channel_id === voiceChannel.id &&
				vs.connection_id === serverUpdate.connection_id
			);
		});

		expect(stateUpdate.user_id).toBe(account.userId);
		expect(stateUpdate.channel_id).toBe(voiceChannel.id);
		expect(stateUpdate.guild_id).toBe(guild.id);
		expect(stateUpdate.self_mute).toBe(false);
		expect(stateUpdate.self_deaf).toBe(false);
	});

	test('should disconnect from voice channel when sending null channel_id', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		gateway.sendVoiceStateUpdate(guild.id, voiceChannel.id, null, false, false, false, false);

		const serverUpdate = await gateway.waitForVoiceServerUpdate(10000);
		const connectionId = serverUpdate.connection_id;
		await confirmVoiceConnectionForTest({
			guildId: guild.id,
			channelId: voiceChannel.id,
			connectionId,
		});

		await gateway.waitForVoiceStateUpdate(10000, (vs: VoiceStateUpdate) => {
			return vs.user_id === account.userId && vs.channel_id === voiceChannel.id && vs.connection_id === connectionId;
		});

		gateway.sendVoiceStateUpdate(guild.id, null, connectionId, false, false, false, false);

		const disconnectUpdate = await gateway.waitForVoiceStateUpdate(10000, (vs: VoiceStateUpdate) => {
			return vs.user_id === account.userId && vs.channel_id === null;
		});

		expect(disconnectUpdate.channel_id).toBeNull();
	});

	test('should update self_mute state', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		gateway.sendVoiceStateUpdate(guild.id, voiceChannel.id, null, true, false, false, false);
		const serverUpdate = await gateway.waitForVoiceServerUpdate(10000);
		await confirmVoiceConnectionForTest({
			guildId: guild.id,
			channelId: voiceChannel.id,
			connectionId: serverUpdate.connection_id,
		});

		const stateUpdate = await gateway.waitForVoiceStateUpdate(10000, (vs: VoiceStateUpdate) => {
			return (
				vs.user_id === account.userId &&
				vs.channel_id === voiceChannel.id &&
				vs.connection_id === serverUpdate.connection_id
			);
		});

		expect(stateUpdate.self_mute).toBe(true);
		expect(stateUpdate.self_deaf).toBe(false);
	});

	test('should update self_deaf state', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		gateway.sendVoiceStateUpdate(guild.id, voiceChannel.id, null, false, true, false, false);
		const serverUpdate = await gateway.waitForVoiceServerUpdate(10000);
		await confirmVoiceConnectionForTest({
			guildId: guild.id,
			channelId: voiceChannel.id,
			connectionId: serverUpdate.connection_id,
		});

		const stateUpdate = await gateway.waitForVoiceStateUpdate(10000, (vs: VoiceStateUpdate) => {
			return (
				vs.user_id === account.userId &&
				vs.channel_id === voiceChannel.id &&
				vs.connection_id === serverUpdate.connection_id
			);
		});

		expect(stateUpdate.self_deaf).toBe(true);
	});

	test('should update self_video state', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		gateway.sendVoiceStateUpdate(guild.id, voiceChannel.id, null, false, false, true, false);
		const serverUpdate = await gateway.waitForVoiceServerUpdate(10000);
		await confirmVoiceConnectionForTest({
			guildId: guild.id,
			channelId: voiceChannel.id,
			connectionId: serverUpdate.connection_id,
		});

		const stateUpdate = await gateway.waitForVoiceStateUpdate(10000, (vs: VoiceStateUpdate) => {
			return (
				vs.user_id === account.userId &&
				vs.channel_id === voiceChannel.id &&
				vs.connection_id === serverUpdate.connection_id
			);
		});

		expect(stateUpdate.self_video).toBe(true);
	});

	test('should include connection_id in voice updates', async () => {
		gateway = await createGatewayClient(account.token);
		gateway.activateGuild(guild.id);
		await new Promise((r) => setTimeout(r, 100));

		gateway.sendVoiceStateUpdate(guild.id, voiceChannel.id, null, false, false, false, false);

		const serverUpdate = await gateway.waitForVoiceServerUpdate(10000);
		expect(serverUpdate.connection_id).toBeTruthy();
		expect(typeof serverUpdate.connection_id).toBe('string');
		await confirmVoiceConnectionForTest({
			guildId: guild.id,
			channelId: voiceChannel.id,
			connectionId: serverUpdate.connection_id,
		});

		const stateUpdate = await gateway.waitForVoiceStateUpdate(10000, (vs: VoiceStateUpdate) => {
			return vs.user_id === account.userId && vs.connection_id === serverUpdate.connection_id;
		});

		expect(stateUpdate.connection_id).toBe(serverUpdate.connection_id);
	});
});
