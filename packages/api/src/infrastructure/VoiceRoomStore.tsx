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

import type {ChannelID, GuildID} from '@fluxer/api/src/BrandedTypes';
import {
	VOICE_OCCUPANCY_REGION_KEY_PREFIX,
	VOICE_OCCUPANCY_SERVER_KEY_PREFIX,
} from '@fluxer/api/src/voice/VoiceConstants';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';

export interface PinnedRoomServer {
	regionId: string;
	serverId: string;
	endpoint: string;
}

export class VoiceRoomStore {
	private kvClient: IKVProvider;
	private readonly keyPrefix = 'voice:room:server';

	constructor(kvClient: IKVProvider) {
		this.kvClient = kvClient;
	}

	private getRoomKey(guildId: GuildID | undefined, channelId: ChannelID): string {
		if (guildId === undefined) {
			return `${this.keyPrefix}:dm:${channelId}`;
		}
		return `${this.keyPrefix}:guild:${guildId}:${channelId}`;
	}

	async pinRoomServer(
		guildId: GuildID | undefined,
		channelId: ChannelID,
		regionId: string,
		serverId: string,
		endpoint: string,
	): Promise<void> {
		const key = this.getRoomKey(guildId, channelId);
		const previous = await this.getPinnedRoomServer(guildId, channelId);

		if (previous) {
			await this.removeOccupancy(previous.regionId, previous.serverId, guildId, channelId);
		}

		await this.kvClient.set(
			key,
			JSON.stringify({
				regionId,
				serverId,
				endpoint,
				updatedAt: new Date().toISOString(),
			}),
		);

		await this.addOccupancy(regionId, serverId, guildId, channelId);
	}

	async getPinnedRoomServer(guildId: GuildID | undefined, channelId: ChannelID): Promise<PinnedRoomServer | null> {
		const key = this.getRoomKey(guildId, channelId);
		const data = await this.kvClient.get(key);
		if (!data) return null;

		const parsed = JSON.parse(data) as {regionId?: string; serverId?: string; endpoint?: string};
		if (!parsed.regionId || !parsed.serverId || !parsed.endpoint) {
			return null;
		}

		return {
			regionId: parsed.regionId,
			serverId: parsed.serverId,
			endpoint: parsed.endpoint,
		};
	}

	async deleteRoomServer(guildId: GuildID | undefined, channelId: ChannelID): Promise<void> {
		const key = this.getRoomKey(guildId, channelId);
		const previous = await this.getPinnedRoomServer(guildId, channelId);
		await this.kvClient.del(key);

		if (previous) {
			await this.removeOccupancy(previous.regionId, previous.serverId, guildId, channelId);
		}
	}

	async getRegionOccupancy(regionId: string): Promise<Array<string>> {
		const key = `${VOICE_OCCUPANCY_REGION_KEY_PREFIX}:${regionId}`;
		const members = await this.kvClient.smembers(key);
		return members;
	}

	async getServerOccupancy(regionId: string, serverId: string): Promise<Array<string>> {
		const key = `${VOICE_OCCUPANCY_SERVER_KEY_PREFIX}:${regionId}:${serverId}`;
		const members = await this.kvClient.smembers(key);
		return members;
	}

	private async addOccupancy(
		regionId: string,
		serverId: string,
		guildId: GuildID | undefined,
		channelId: ChannelID,
	): Promise<void> {
		const member = this.buildOccupancyMember(guildId, channelId);
		const regionKey = `${VOICE_OCCUPANCY_REGION_KEY_PREFIX}:${regionId}`;
		const serverKey = `${VOICE_OCCUPANCY_SERVER_KEY_PREFIX}:${regionId}:${serverId}`;

		await this.kvClient.multi().sadd(regionKey, member).sadd(serverKey, member).exec();
	}

	private async removeOccupancy(
		regionId: string,
		serverId: string,
		guildId: GuildID | undefined,
		channelId: ChannelID,
	): Promise<void> {
		const member = this.buildOccupancyMember(guildId, channelId);
		const regionKey = `${VOICE_OCCUPANCY_REGION_KEY_PREFIX}:${regionId}`;
		const serverKey = `${VOICE_OCCUPANCY_SERVER_KEY_PREFIX}:${regionId}:${serverId}`;

		await this.kvClient.multi().srem(regionKey, member).srem(serverKey, member).exec();
	}

	private buildOccupancyMember(guildId: GuildID | undefined, channelId: ChannelID): string {
		if (!guildId) {
			return `dm:${channelId.toString()}`;
		}
		return `guild:${guildId.toString()}:channel:${channelId.toString()}`;
	}
}
