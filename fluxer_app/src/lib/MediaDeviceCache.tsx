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

type MediaDeviceCacheKind = 'audio' | 'video';

interface CachedDeviceEntry {
	devices: Array<MediaDeviceInfo>;
	fetchedAt: number;
}

type DeviceFetcher = () => Promise<Array<MediaDeviceInfo>>;

class MediaDeviceCache {
	private cache = new Map<MediaDeviceCacheKind, CachedDeviceEntry>();

	async getDevices(type: MediaDeviceCacheKind, fetchDevices: DeviceFetcher): Promise<CachedDeviceEntry> {
		const cached = this.cache.get(type);
		if (cached) {
			return cached;
		}
		const devices = await fetchDevices();
		const entry = {devices, fetchedAt: Date.now()};
		this.cache.set(type, entry);
		return entry;
	}

	invalidate(type: MediaDeviceCacheKind): void {
		this.cache.delete(type);
	}

	invalidateAll(): void {
		this.cache.clear();
	}

	startDeviceChangeListener(): () => void {
		return () => {};
	}
}

export const mediaDeviceCache = new MediaDeviceCache();
