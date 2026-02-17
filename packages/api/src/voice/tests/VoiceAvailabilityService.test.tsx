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

import type {GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {VoiceAccessContext} from '@fluxer/api/src/voice/VoiceAvailabilityService';
import {VoiceAvailabilityService} from '@fluxer/api/src/voice/VoiceAvailabilityService';
import type {VoiceRegionRecord, VoiceServerRecord} from '@fluxer/api/src/voice/VoiceModel';
import type {VoiceTopology} from '@fluxer/api/src/voice/VoiceTopology';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import {describe, expect, it} from 'vitest';

function createMockRegion(overrides: Partial<VoiceRegionRecord> = {}): VoiceRegionRecord {
	return {
		id: 'us-default',
		name: 'US Default',
		emoji: 'flag',
		latitude: 39.8283,
		longitude: -98.5795,
		isDefault: true,
		restrictions: {
			vipOnly: false,
			requiredGuildFeatures: new Set(),
			allowedGuildIds: new Set(),
			allowedUserIds: new Set(),
		},
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function createMockServer(overrides: Partial<VoiceServerRecord> = {}): VoiceServerRecord {
	return {
		regionId: 'us-default',
		serverId: 'server-1',
		endpoint: 'wss://voice.example.com',
		apiKey: 'test-key',
		apiSecret: 'test-secret',
		isActive: true,
		restrictions: {
			vipOnly: false,
			requiredGuildFeatures: new Set(),
			allowedGuildIds: new Set(),
			allowedUserIds: new Set(),
		},
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function createMockTopology(
	regions: Array<VoiceRegionRecord>,
	serversByRegion: Map<string, Array<VoiceServerRecord>>,
): VoiceTopology {
	return {
		getAllRegions: () => regions,
		getServersForRegion: (regionId: string) => serversByRegion.get(regionId) ?? [],
		getRegionMetadataList: () =>
			regions.map((r) => ({
				id: r.id,
				name: r.name,
				emoji: r.emoji,
				latitude: r.latitude,
				longitude: r.longitude,
				isDefault: r.isDefault,
				vipOnly: r.restrictions.vipOnly,
				requiredGuildFeatures: Array.from(r.restrictions.requiredGuildFeatures),
			})),
	} as VoiceTopology;
}

describe('VoiceAvailabilityService', () => {
	let service: VoiceAvailabilityService;

	describe('isRegionAccessible', () => {
		it('returns true for unrestricted region', () => {
			const region = createMockRegion();
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			expect(service.isRegionAccessible(region, context)).toBe(true);
		});

		it('returns false when user is not in allowedUserIds', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set([456n as UserID]),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			expect(service.isRegionAccessible(region, context)).toBe(false);
		});

		it('returns true when user is in allowedUserIds', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set([123n as UserID]),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			expect(service.isRegionAccessible(region, context)).toBe(true);
		});

		it('returns false for vipOnly region without VIP_VOICE feature', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: true,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set(),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
				guildId: 456n as GuildID,
				guildFeatures: new Set(),
			};

			expect(service.isRegionAccessible(region, context)).toBe(false);
		});

		it('returns true for vipOnly region with VIP_VOICE feature', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: true,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set(),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
				guildId: 456n as GuildID,
				guildFeatures: new Set([GuildFeatures.VIP_VOICE]),
			};

			expect(service.isRegionAccessible(region, context)).toBe(true);
		});

		it('returns false for vipOnly region without guildId', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: true,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set(),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			expect(service.isRegionAccessible(region, context)).toBe(false);
		});

		it('returns true for guild in allowedGuildIds', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set([456n as GuildID]),
					allowedUserIds: new Set(),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
				guildId: 456n as GuildID,
			};

			expect(service.isRegionAccessible(region, context)).toBe(true);
		});

		it('returns false for guild not in allowedGuildIds', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set([789n as GuildID]),
					allowedUserIds: new Set(),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
				guildId: 456n as GuildID,
			};

			expect(service.isRegionAccessible(region, context)).toBe(false);
		});

		it('returns true for guild with required feature', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(['PREMIUM']),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set(),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
				guildId: 456n as GuildID,
				guildFeatures: new Set(['PREMIUM']),
			};

			expect(service.isRegionAccessible(region, context)).toBe(true);
		});

		it('returns false for guild without required feature', () => {
			const region = createMockRegion({
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(['PREMIUM']),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set(),
				},
			});
			const topology = createMockTopology([region], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
				guildId: 456n as GuildID,
				guildFeatures: new Set(),
			};

			expect(service.isRegionAccessible(region, context)).toBe(false);
		});
	});

	describe('isServerAccessible', () => {
		it('returns false for inactive server', () => {
			const region = createMockRegion();
			const server = createMockServer({isActive: false});
			const topology = createMockTopology([region], new Map([['us-default', [server]]]));
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			expect(service.isServerAccessible(server, context)).toBe(false);
		});

		it('returns true for active unrestricted server', () => {
			const region = createMockRegion();
			const server = createMockServer();
			const topology = createMockTopology([region], new Map([['us-default', [server]]]));
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			expect(service.isServerAccessible(server, context)).toBe(true);
		});

		it('returns false when user is not in server allowedUserIds', () => {
			const region = createMockRegion();
			const server = createMockServer({
				restrictions: {
					vipOnly: false,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set([456n as UserID]),
				},
			});
			const topology = createMockTopology([region], new Map([['us-default', [server]]]));
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			expect(service.isServerAccessible(server, context)).toBe(false);
		});
	});

	describe('getAvailableRegions', () => {
		it('returns regions with accessibility status', () => {
			const region1 = createMockRegion({id: 'us-default', isDefault: true});
			const region2 = createMockRegion({
				id: 'eu-vip',
				isDefault: false,
				restrictions: {
					vipOnly: true,
					requiredGuildFeatures: new Set(),
					allowedGuildIds: new Set(),
					allowedUserIds: new Set(),
				},
			});
			const server1 = createMockServer({regionId: 'us-default'});
			const topology = createMockTopology(
				[region1, region2],
				new Map([
					['us-default', [server1]],
					['eu-vip', []],
				]),
			);
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			const regions = service.getAvailableRegions(context);

			expect(regions).toHaveLength(2);
			expect(regions[0].id).toBe('us-default');
			expect(regions[0].isAccessible).toBe(true);
			expect(regions[1].id).toBe('eu-vip');
			expect(regions[1].isAccessible).toBe(false);
		});

		it('marks region as not accessible if no servers are available', () => {
			const region = createMockRegion();
			const topology = createMockTopology([region], new Map([['us-default', []]]));
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			const regions = service.getAvailableRegions(context);

			expect(regions).toHaveLength(1);
			expect(regions[0].isAccessible).toBe(false);
			expect(regions[0].serverCount).toBe(0);
		});
	});

	describe('selectServer', () => {
		it('returns server from specified region', () => {
			const region = createMockRegion();
			const server = createMockServer();
			const topology = createMockTopology([region], new Map([['us-default', [server]]]));
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			const selected = service.selectServer('us-default', context);

			expect(selected).not.toBeNull();
			expect(selected!.serverId).toBe('server-1');
		});

		it('returns null for region with no servers', () => {
			const region = createMockRegion();
			const topology = createMockTopology([region], new Map([['us-default', []]]));
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			const selected = service.selectServer('us-default', context);

			expect(selected).toBeNull();
		});

		it('returns null for non-existent region', () => {
			const topology = createMockTopology([], new Map());
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			const selected = service.selectServer('non-existent', context);

			expect(selected).toBeNull();
		});

		it('rotates between accessible servers', () => {
			const region = createMockRegion();
			const server1 = createMockServer({serverId: 'server-1'});
			const server2 = createMockServer({serverId: 'server-2'});
			const topology = createMockTopology([region], new Map([['us-default', [server1, server2]]]));
			service = new VoiceAvailabilityService(topology);

			const context: VoiceAccessContext = {
				requestingUserId: 123n as UserID,
			};

			const first = service.selectServer('us-default', context);
			const second = service.selectServer('us-default', context);
			const third = service.selectServer('us-default', context);

			expect(first!.serverId).toBe('server-1');
			expect(second!.serverId).toBe('server-2');
			expect(third!.serverId).toBe('server-1');
		});
	});
});
