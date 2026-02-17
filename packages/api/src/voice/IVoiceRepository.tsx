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

import type {VoiceRegionRecord, VoiceRegionWithServers, VoiceServerRecord} from '@fluxer/api/src/voice/VoiceModel';

export interface IVoiceRepository {
	listRegions(): Promise<Array<VoiceRegionRecord>>;
	listRegionsWithServers(): Promise<Array<VoiceRegionWithServers>>;
	getRegion(id: string): Promise<VoiceRegionRecord | null>;
	getRegionWithServers(id: string): Promise<VoiceRegionWithServers | null>;
	upsertRegion(region: VoiceRegionRecord): Promise<void>;
	deleteRegion(regionId: string): Promise<void>;
	createRegion(region: Omit<VoiceRegionRecord, 'createdAt' | 'updatedAt'>): Promise<VoiceRegionRecord>;
	listServersForRegion(regionId: string): Promise<Array<VoiceServerRecord>>;
	listServers(regionId: string): Promise<Array<VoiceServerRecord>>;
	getServer(regionId: string, serverId: string): Promise<VoiceServerRecord | null>;
	createServer(server: Omit<VoiceServerRecord, 'createdAt' | 'updatedAt'>): Promise<VoiceServerRecord>;
	upsertServer(server: VoiceServerRecord): Promise<void>;
	deleteServer(regionId: string, serverId: string): Promise<void>;
}
