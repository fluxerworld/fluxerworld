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

import {SNOWFLAKE_RESERVATION_REFRESH_CHANNEL} from '@fluxer/api/src/constants/InstanceConfig';
import type {
	SnowflakeReservationConfig,
	SnowflakeReservationRepository,
} from '@fluxer/api/src/instance/SnowflakeReservationRepository';
import {Logger} from '@fluxer/api/src/Logger';
import type {IKVProvider, IKVSubscription} from '@fluxer/kv_client/src/IKVProvider';

export class SnowflakeReservationService {
	private reservations = new Map<string, bigint>();
	private initialized = false;
	private reloadPromise: Promise<void> | null = null;
	private kvSubscription: IKVSubscription | null = null;

	constructor(
		private repository: SnowflakeReservationRepository,
		private kvClient: IKVProvider | null,
	) {}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		await this.reload();
		this.initialized = true;

		if (this.kvClient) {
			try {
				const subscription = this.kvClient.duplicate();
				this.kvSubscription = subscription;
				await subscription.connect();
				await subscription.subscribe(SNOWFLAKE_RESERVATION_REFRESH_CHANNEL);
				subscription.on('message', (channel) => {
					if (channel === SNOWFLAKE_RESERVATION_REFRESH_CHANNEL) {
						this.reload().catch((error) => {
							Logger.error({error}, 'Failed to reload snowflake reservations');
						});
					}
				});
			} catch (error) {
				Logger.error({error}, 'Failed to subscribe to snowflake reservation refresh channel');
			}
		}
	}

	async reload(): Promise<void> {
		if (this.reloadPromise) {
			return this.reloadPromise;
		}

		this.reloadPromise = (async () => {
			const entries = await this.repository.listReservations();
			this.reservations = this.buildLookup(entries);
		})()
			.catch((error) => {
				Logger.error({error}, 'Failed to reload snowflake reservations from the database');
				throw error;
			})
			.finally(() => {
				this.reloadPromise = null;
			});

		return this.reloadPromise;
	}

	getReservedSnowflake(emailKey: string | null): bigint | null {
		if (!emailKey) {
			return null;
		}
		return this.reservations.get(emailKey) ?? null;
	}

	private buildLookup(entries: Array<SnowflakeReservationConfig>): Map<string, bigint> {
		const lookup = new Map<string, bigint>();
		for (const entry of entries) {
			lookup.set(entry.emailKey, entry.snowflake);
		}
		return lookup;
	}

	shutdown(): void {
		if (this.kvSubscription) {
			this.kvSubscription.disconnect();
			this.kvSubscription = null;
		}
	}
}
