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

import {SNOWFLAKE_RESERVATION_KEY_PREFIX} from '@fluxer/api/src/constants/InstanceConfig';
import {deleteOneOrMany, fetchMany, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {InstanceConfigurationRow} from '@fluxer/api/src/database/types/InstanceConfigTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {InstanceConfiguration} from '@fluxer/api/src/Tables';

const FETCH_ALL_CONFIG_QUERY = InstanceConfiguration.selectCql();

export interface SnowflakeReservationConfig {
	emailKey: string;
	snowflake: bigint;
	updatedAt: Date | null;
}

export class SnowflakeReservationRepository {
	async listReservations(): Promise<Array<SnowflakeReservationConfig>> {
		const rows = await fetchMany<InstanceConfigurationRow>(FETCH_ALL_CONFIG_QUERY, {});
		const reservations: Array<SnowflakeReservationConfig> = [];

		for (const row of rows) {
			if (!row.key.startsWith(SNOWFLAKE_RESERVATION_KEY_PREFIX) || row.value == null || row.value.trim().length === 0) {
				continue;
			}

			const emailKey = row.key.slice(SNOWFLAKE_RESERVATION_KEY_PREFIX.length);
			if (!emailKey) continue;

			const snowflakeString = row.value.trim();
			try {
				const snowflake = BigInt(snowflakeString);
				reservations.push({
					emailKey,
					snowflake,
					updatedAt: row.updated_at ?? null,
				});
			} catch (error) {
				Logger.warn({key: row.key, value: row.value, error}, 'Skipping invalid snowflake reservation value');
			}
		}

		return reservations;
	}

	async setReservation(emailKey: string, snowflake: bigint): Promise<void> {
		await upsertOne(
			InstanceConfiguration.upsertAll({
				key: `${SNOWFLAKE_RESERVATION_KEY_PREFIX}${emailKey}`,
				value: snowflake.toString(),
				updated_at: new Date(),
			}),
		);
	}

	async deleteReservation(emailKey: string): Promise<void> {
		await deleteOneOrMany(
			InstanceConfiguration.deleteCql({
				where: InstanceConfiguration.where.eq('key'),
			}),
			{key: `${SNOWFLAKE_RESERVATION_KEY_PREFIX}${emailKey}`},
		);
	}
}
