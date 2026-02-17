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

import type {ChannelID, GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {ILiveKitService, ListParticipantsResult} from '@fluxer/api/src/infrastructure/ILiveKitService';
import type {VoiceRegionMetadata, VoiceServerRecord} from '@fluxer/api/src/voice/VoiceModel';
import {vi} from 'vitest';

export interface MockLiveKitServiceConfig {
	disconnectParticipantThrows?: Error;
	listParticipantsResult?: ListParticipantsResult;
	regionMetadata?: Array<VoiceRegionMetadata>;
	defaultRegionId?: string | null;
}

export class MockLiveKitService implements ILiveKitService {
	readonly createTokenSpy = vi.fn();
	readonly updateParticipantSpy = vi.fn();
	readonly updateParticipantPermissionsSpy = vi.fn();
	readonly disconnectParticipantSpy = vi.fn();
	readonly listParticipantsSpy = vi.fn();

	private config: MockLiveKitServiceConfig;

	constructor(config: MockLiveKitServiceConfig = {}) {
		this.config = config;
	}

	configure(config: MockLiveKitServiceConfig): void {
		this.config = {...this.config, ...config};
	}

	async createToken(params: {
		userId: UserID;
		guildId?: GuildID;
		channelId: ChannelID;
		connectionId: string;
		tokenNonce: string;
		regionId: string;
		serverId: string;
		mute?: boolean;
		deaf?: boolean;
		canSpeak?: boolean;
		canStream?: boolean;
		canVideo?: boolean;
	}): Promise<{token: string; endpoint: string}> {
		this.createTokenSpy(params);
		return {
			token: `token-${params.connectionId}`,
			endpoint: 'wss://livekit.example.com',
		};
	}

	async updateParticipant(params: {
		userId: UserID;
		guildId?: GuildID;
		channelId: ChannelID;
		connectionId: string;
		regionId: string;
		serverId: string;
		mute?: boolean;
		deaf?: boolean;
	}): Promise<void> {
		this.updateParticipantSpy(params);
	}

	async updateParticipantPermissions(params: {
		userId: UserID;
		guildId?: GuildID;
		channelId: ChannelID;
		connectionId: string;
		regionId: string;
		serverId: string;
		canSpeak: boolean;
		canStream: boolean;
		canVideo: boolean;
	}): Promise<void> {
		this.updateParticipantPermissionsSpy(params);
	}

	async disconnectParticipant(params: {
		userId: UserID;
		guildId?: GuildID;
		channelId: ChannelID;
		connectionId: string;
		regionId: string;
		serverId: string;
	}): Promise<void> {
		this.disconnectParticipantSpy(params);
		if (this.config.disconnectParticipantThrows) {
			throw this.config.disconnectParticipantThrows;
		}
	}

	async listParticipants(params: {
		guildId?: GuildID;
		channelId: ChannelID;
		regionId: string;
		serverId: string;
	}): Promise<ListParticipantsResult> {
		this.listParticipantsSpy(params);
		return this.config.listParticipantsResult ?? {status: 'ok', participants: []};
	}

	getDefaultRegionId(): string | null {
		return this.config.defaultRegionId ?? null;
	}

	getRegionMetadata(): Array<VoiceRegionMetadata> {
		return this.config.regionMetadata ?? [];
	}

	getServer(_regionId: string, _serverId: string): VoiceServerRecord | null {
		return null;
	}

	reset(): void {
		this.createTokenSpy.mockClear();
		this.updateParticipantSpy.mockClear();
		this.updateParticipantPermissionsSpy.mockClear();
		this.disconnectParticipantSpy.mockClear();
		this.listParticipantsSpy.mockClear();
		this.config = {};
	}
}
