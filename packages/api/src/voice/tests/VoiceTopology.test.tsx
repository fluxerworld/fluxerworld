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

import type {IVoiceRepository} from '@fluxer/api/src/voice/IVoiceRepository';
import type {VoiceRegionWithServers} from '@fluxer/api/src/voice/VoiceModel';
import {VoiceTopology} from '@fluxer/api/src/voice/VoiceTopology';
import {beforeEach, describe, expect, it, vi} from 'vitest';

function createMockVoiceRepository(regions: Array<VoiceRegionWithServers>): IVoiceRepository {
	return {
		listRegionsWithServers: vi.fn().mockResolvedValue(regions),
		listRegions: vi.fn().mockResolvedValue(regions),
		getRegion: vi.fn().mockResolvedValue(null),
		getRegionWithServers: vi.fn().mockResolvedValue(null),
		upsertRegion: vi.fn().mockResolvedValue(undefined),
		deleteRegion: vi.fn().mockResolvedValue(undefined),
		createRegion: vi.fn().mockResolvedValue(null),
		listServersForRegion: vi.fn().mockResolvedValue([]),
		listServers: vi.fn().mockResolvedValue([]),
		getServer: vi.fn().mockResolvedValue(null),
		createServer: vi.fn().mockResolvedValue(null),
		upsertServer: vi.fn().mockResolvedValue(undefined),
		deleteServer: vi.fn().mockResolvedValue(undefined),
	};
}

describe('VoiceTopology', () => {
	let topology: VoiceTopology;

	const mockRegions: Array<VoiceRegionWithServers> = [
		{
			id: 'us-default',
			name: 'US Default',
			emoji: 'flag-us',
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
			servers: [
				{
					regionId: 'us-default',
					serverId: 'us-server-1',
					endpoint: 'wss://us1.voice.example.com',

					apiKey: 'key1',
					apiSecret: 'secret1',
					isActive: true,
					restrictions: {
						vipOnly: false,
						requiredGuildFeatures: new Set(),
						allowedGuildIds: new Set(),
						allowedUserIds: new Set(),
					},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				{
					regionId: 'us-default',
					serverId: 'us-server-2',
					endpoint: 'wss://us2.voice.example.com',

					apiKey: 'key2',
					apiSecret: 'secret2',
					isActive: true,
					restrictions: {
						vipOnly: false,
						requiredGuildFeatures: new Set(),
						allowedGuildIds: new Set(),
						allowedUserIds: new Set(),
					},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
		},
		{
			id: 'eu-default',
			name: 'EU Default',
			emoji: 'flag-eu',
			latitude: 50.0755,
			longitude: 14.4378,
			isDefault: false,
			restrictions: {
				vipOnly: false,
				requiredGuildFeatures: new Set(),
				allowedGuildIds: new Set(),
				allowedUserIds: new Set(),
			},
			createdAt: new Date(),
			updatedAt: new Date(),
			servers: [
				{
					regionId: 'eu-default',
					serverId: 'eu-server-1',
					endpoint: 'wss://eu1.voice.example.com',

					apiKey: 'key3',
					apiSecret: 'secret3',
					isActive: true,
					restrictions: {
						vipOnly: false,
						requiredGuildFeatures: new Set(),
						allowedGuildIds: new Set(),
						allowedUserIds: new Set(),
					},
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
		},
	];

	beforeEach(() => {
		const repository = createMockVoiceRepository(mockRegions);
		topology = new VoiceTopology(repository, null);
	});

	describe('before initialization', () => {
		it('returns null for default region before initialization', () => {
			expect(topology.getDefaultRegion()).toBeNull();
		});

		it('returns null for default region id before initialization', () => {
			expect(topology.getDefaultRegionId()).toBeNull();
		});

		it('returns empty array for all regions before initialization', () => {
			expect(topology.getAllRegions()).toHaveLength(0);
		});
	});

	describe('after initialization', () => {
		beforeEach(async () => {
			await topology.initialize();
		});

		it('returns default region after initialization', () => {
			const defaultRegion = topology.getDefaultRegion();

			expect(defaultRegion).not.toBeNull();
			expect(defaultRegion!.id).toBe('us-default');
			expect(defaultRegion!.isDefault).toBe(true);
		});

		it('returns default region id after initialization', () => {
			expect(topology.getDefaultRegionId()).toBe('us-default');
		});

		it('returns all regions after initialization', () => {
			const regions = topology.getAllRegions();

			expect(regions).toHaveLength(2);
			expect(regions[0].id).toBe('us-default');
			expect(regions[1].id).toBe('eu-default');
		});

		it('returns specific region by id', () => {
			const region = topology.getRegion('eu-default');

			expect(region).not.toBeNull();
			expect(region!.id).toBe('eu-default');
			expect(region!.name).toBe('EU Default');
		});

		it('returns null for non-existent region', () => {
			const region = topology.getRegion('non-existent');

			expect(region).toBeNull();
		});

		it('returns servers for a region', () => {
			const servers = topology.getServersForRegion('us-default');

			expect(servers).toHaveLength(2);
			expect(servers[0].serverId).toBe('us-server-1');
			expect(servers[1].serverId).toBe('us-server-2');
		});

		it('returns empty array for region with no servers', () => {
			const servers = topology.getServersForRegion('non-existent');

			expect(servers).toHaveLength(0);
		});

		it('returns specific server by region and server id', () => {
			const server = topology.getServer('us-default', 'us-server-2');

			expect(server).not.toBeNull();
			expect(server!.serverId).toBe('us-server-2');
			expect(server!.endpoint).toBe('wss://us2.voice.example.com');
		});

		it('returns null for non-existent server', () => {
			const server = topology.getServer('us-default', 'non-existent');

			expect(server).toBeNull();
		});

		it('returns null for server in non-existent region', () => {
			const server = topology.getServer('non-existent', 'us-server-1');

			expect(server).toBeNull();
		});

		it('returns region metadata list', () => {
			const metadata = topology.getRegionMetadataList();

			expect(metadata).toHaveLength(2);
			expect(metadata[0]).toEqual({
				id: 'us-default',
				name: 'US Default',
				emoji: 'flag-us',
				latitude: 39.8283,
				longitude: -98.5795,
				isDefault: true,
				vipOnly: false,
				requiredGuildFeatures: [],
			});
		});
	});

	describe('getNextServer', () => {
		beforeEach(async () => {
			await topology.initialize();
		});

		it('rotates through servers in order', () => {
			const first = topology.getNextServer('us-default');
			const second = topology.getNextServer('us-default');
			const third = topology.getNextServer('us-default');

			expect(first!.serverId).toBe('us-server-1');
			expect(second!.serverId).toBe('us-server-2');
			expect(third!.serverId).toBe('us-server-1');
		});

		it('returns null for region with no servers', () => {
			const server = topology.getNextServer('non-existent');

			expect(server).toBeNull();
		});
	});

	describe('subscriber management', () => {
		it('registers and unregisters subscribers', () => {
			const subscriber = vi.fn();

			topology.registerSubscriber(subscriber);
			topology.unregisterSubscriber(subscriber);
		});
	});

	describe('shutdown', () => {
		it('shuts down without error', () => {
			expect(() => topology.shutdown()).not.toThrow();
		});
	});

	describe('empty regions', () => {
		it('handles empty region list', async () => {
			const repository = createMockVoiceRepository([]);
			topology = new VoiceTopology(repository, null);

			await topology.initialize();

			expect(topology.getAllRegions()).toHaveLength(0);
			expect(topology.getDefaultRegion()).toBeNull();
			expect(topology.getDefaultRegionId()).toBeNull();
		});
	});

	describe('no default region', () => {
		it('uses first region as fallback when no default is set', async () => {
			const regionsWithoutDefault: Array<VoiceRegionWithServers> = [
				{
					...mockRegions[0],
					isDefault: false,
				},
				mockRegions[1],
			];

			const repository = createMockVoiceRepository(regionsWithoutDefault);
			topology = new VoiceTopology(repository, null);

			await topology.initialize();

			expect(topology.getDefaultRegionId()).toBe('us-default');
		});
	});
});
