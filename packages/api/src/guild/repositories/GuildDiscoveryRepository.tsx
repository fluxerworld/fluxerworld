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

import type {GuildID} from '@fluxer/api/src/BrandedTypes';
import {BatchBuilder, fetchMany, fetchOne} from '@fluxer/api/src/database/Cassandra';
import type {GuildDiscoveryByStatusRow, GuildDiscoveryRow} from '@fluxer/api/src/database/types/GuildDiscoveryTypes';
import {GuildDiscovery, GuildDiscoveryByStatus} from '@fluxer/api/src/Tables';
import {DiscoveryCategories} from '@fluxer/constants/src/DiscoveryConstants';

const FETCH_DISCOVERY_BY_GUILD_ID = GuildDiscovery.selectCql({
	where: GuildDiscovery.where.eq('guild_id'),
	limit: 1,
});

const FETCH_DISCOVERY_BY_STATUS = GuildDiscoveryByStatus.selectCql({
	where: GuildDiscoveryByStatus.where.eq('status'),
});

export abstract class IGuildDiscoveryRepository {
	abstract findByGuildId(guildId: GuildID): Promise<GuildDiscoveryRow | null>;
	abstract listByStatus(status: string, limit: number): Promise<Array<GuildDiscoveryByStatusRow>>;
	abstract upsert(row: GuildDiscoveryRow): Promise<void>;
	abstract deleteByGuildId(guildId: GuildID, status: string, appliedAt: Date): Promise<void>;
	abstract updateStatus(
		guildId: GuildID,
		oldStatus: string,
		oldAppliedAt: Date,
		updatedRow: GuildDiscoveryRow,
	): Promise<void>;
}

export class GuildDiscoveryRepository extends IGuildDiscoveryRepository {
	async findByGuildId(guildId: GuildID): Promise<GuildDiscoveryRow | null> {
		const row = await fetchOne<GuildDiscoveryRow>(FETCH_DISCOVERY_BY_GUILD_ID, {
			guild_id: guildId,
		});
		if (row) {
			row.category_type ??= DiscoveryCategories.GAMING;
		}
		return row;
	}

	async listByStatus(status: string, limit: number): Promise<Array<GuildDiscoveryByStatusRow>> {
		const rows = await fetchMany<GuildDiscoveryByStatusRow>(FETCH_DISCOVERY_BY_STATUS, {
			status,
		});
		return rows.slice(0, limit);
	}

	async upsert(row: GuildDiscoveryRow): Promise<void> {
		const batch = new BatchBuilder();
		batch.addPrepared(
			GuildDiscovery.insert({
				guild_id: row.guild_id,
				status: row.status,
				category_type: row.category_type,
				description: row.description,
				applied_at: row.applied_at,
				reviewed_at: row.reviewed_at,
				reviewed_by: row.reviewed_by,
				review_reason: row.review_reason,
				removed_at: row.removed_at,
				removed_by: row.removed_by,
				removal_reason: row.removal_reason,
			}),
		);
		batch.addPrepared(
			GuildDiscoveryByStatus.insert({
				status: row.status,
				applied_at: row.applied_at,
				guild_id: row.guild_id,
			}),
		);
		await batch.execute();
	}

	async deleteByGuildId(guildId: GuildID, status: string, appliedAt: Date): Promise<void> {
		const batch = new BatchBuilder();
		batch.addPrepared(GuildDiscovery.deleteByPk({guild_id: guildId}));
		batch.addPrepared(
			GuildDiscoveryByStatus.deleteByPk({
				status,
				applied_at: appliedAt,
				guild_id: guildId,
			}),
		);
		await batch.execute();
	}

	async updateStatus(
		guildId: GuildID,
		oldStatus: string,
		oldAppliedAt: Date,
		updatedRow: GuildDiscoveryRow,
	): Promise<void> {
		const batch = new BatchBuilder();
		batch.addPrepared(
			GuildDiscoveryByStatus.deleteByPk({
				status: oldStatus,
				applied_at: oldAppliedAt,
				guild_id: guildId,
			}),
		);
		batch.addPrepared(
			GuildDiscovery.insert({
				guild_id: updatedRow.guild_id,
				status: updatedRow.status,
				category_type: updatedRow.category_type,
				description: updatedRow.description,
				applied_at: updatedRow.applied_at,
				reviewed_at: updatedRow.reviewed_at,
				reviewed_by: updatedRow.reviewed_by,
				review_reason: updatedRow.review_reason,
				removed_at: updatedRow.removed_at,
				removed_by: updatedRow.removed_by,
				removal_reason: updatedRow.removal_reason,
			}),
		);
		batch.addPrepared(
			GuildDiscoveryByStatus.insert({
				status: updatedRow.status,
				applied_at: updatedRow.applied_at,
				guild_id: updatedRow.guild_id,
			}),
		);
		await batch.execute();
	}
}
