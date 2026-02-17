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

import {AdminRepository} from '@fluxer/api/src/admin/AdminRepository';
import {Config} from '@fluxer/api/src/Config';
import {IP_BAN_REFRESH_CHANNEL} from '@fluxer/api/src/constants/IpBan';
import {Logger} from '@fluxer/api/src/Logger';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {parseIpBanEntry, tryParseSingleIp} from '@fluxer/api/src/utils/IpRangeUtils';
import {IpBannedError} from '@fluxer/errors/src/domains/moderation/IpBannedError';
import {extractClientIp} from '@fluxer/ip_utils/src/ClientIp';
import type {IpAddressFamily} from '@fluxer/ip_utils/src/IpAddress';
import type {IKVProvider, IKVSubscription} from '@fluxer/kv_client/src/IKVProvider';
import {createMiddleware} from 'hono/factory';

type FamilyMap<T> = Record<IpAddressFamily, Map<string, T>>;

interface SingleCacheEntry {
	value: bigint;
	count: number;
}

interface RangeCacheEntry {
	start: bigint;
	end: bigint;
	count: number;
}

class IpBanCache {
	private singleIpBans: FamilyMap<SingleCacheEntry>;
	private rangeIpBans: FamilyMap<RangeCacheEntry>;
	private isInitialized = false;
	private adminRepository = new AdminRepository();
	private consecutiveFailures = 0;
	private maxConsecutiveFailures = 5;
	private kvClient: IKVProvider | null = null;
	private kvSubscription: IKVSubscription | null = null;
	private subscriberInitialized = false;

	constructor() {
		this.singleIpBans = this.createFamilyMaps();
		this.rangeIpBans = this.createFamilyMaps();
	}

	setRefreshSubscriber(kvClient: IKVProvider | null): void {
		this.kvClient = kvClient;
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) return;

		await this.refresh();
		this.isInitialized = true;
		this.setupSubscriber();
	}

	private setupSubscriber(): void {
		if (this.subscriberInitialized || !this.kvClient) {
			return;
		}

		const subscription = this.kvClient.duplicate();
		this.kvSubscription = subscription;

		subscription
			.connect()
			.then(() => subscription.subscribe(IP_BAN_REFRESH_CHANNEL))
			.then(() => {
				subscription.on('message', (channel) => {
					if (channel === IP_BAN_REFRESH_CHANNEL) {
						this.refresh().catch((err) => {
							this.consecutiveFailures++;
							const message = err instanceof Error ? err.message : String(err);
							if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
								Logger.error({error: message}, 'Failed to refresh IP ban cache after notification');
							} else {
								Logger.warn({error: message}, 'Failed to refresh IP ban cache after notification');
							}
						});
					}
				});
			})
			.catch((error) => {
				Logger.error({error}, 'Failed to subscribe to IP ban refresh channel');
			});

		this.subscriberInitialized = true;
	}

	async refresh(): Promise<void> {
		const ips = await this.adminRepository.listBannedIps();
		this.resetCaches();
		for (const ip of ips) {
			this.addEntry(ip);
		}
		this.consecutiveFailures = 0;
	}

	isBanned(ip: string): boolean {
		const parsed = tryParseSingleIp(ip);
		if (!parsed) return false;

		const singleMap = this.singleIpBans[parsed.family];
		if (singleMap.has(parsed.canonical)) {
			return true;
		}

		const rangeMap = this.rangeIpBans[parsed.family];
		for (const range of rangeMap.values()) {
			if (parsed.value >= range.start && parsed.value <= range.end) {
				return true;
			}
		}

		return false;
	}

	ban(ip: string): void {
		this.addEntry(ip);
	}

	unban(ip: string): void {
		this.removeEntry(ip);
	}

	resetCaches(): void {
		this.singleIpBans = this.createFamilyMaps();
		this.rangeIpBans = this.createFamilyMaps();
	}

	private createFamilyMaps<T>(): FamilyMap<T> {
		return {
			ipv4: new Map(),
			ipv6: new Map(),
		};
	}

	private addEntry(value: string): void {
		const parsed = parseIpBanEntry(value);
		if (!parsed) {
			Logger.warn({value}, 'Skipping invalid IP ban entry');
			return;
		}

		if (parsed.type === 'single') {
			const map = this.singleIpBans[parsed.family];
			const existing = map.get(parsed.canonical);
			if (existing) {
				existing.count += 1;
			} else {
				map.set(parsed.canonical, {value: parsed.value, count: 1});
			}
		} else {
			const map = this.rangeIpBans[parsed.family];
			const existing = map.get(parsed.canonical);
			if (existing) {
				existing.count += 1;
			} else {
				map.set(parsed.canonical, {start: parsed.start, end: parsed.end, count: 1});
			}
		}
	}

	private removeEntry(value: string): void {
		const parsed = parseIpBanEntry(value);
		if (!parsed) return;

		if (parsed.type === 'single') {
			const map = this.singleIpBans[parsed.family];
			const existing = map.get(parsed.canonical);
			if (!existing) return;
			if (existing.count <= 1) {
				map.delete(parsed.canonical);
			} else {
				existing.count -= 1;
			}
		} else {
			const map = this.rangeIpBans[parsed.family];
			const existing = map.get(parsed.canonical);
			if (!existing) return;
			if (existing.count <= 1) {
				map.delete(parsed.canonical);
			} else {
				existing.count -= 1;
			}
		}
	}

	shutdown(): void {
		if (this.kvSubscription) {
			this.kvSubscription.disconnect();
			this.kvSubscription = null;
		}
	}
}

export const ipBanCache = new IpBanCache();

export const IpBanMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const clientIp = extractClientIp(ctx.req.raw, {trustCfConnectingIp: Config.proxy.trust_cf_connecting_ip});

	if (clientIp && ipBanCache.isBanned(clientIp)) {
		throw new IpBannedError();
	}

	await next();
});
