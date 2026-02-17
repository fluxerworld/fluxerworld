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

import type {
	CreateAdminApiKeyData,
	IAdminApiKeyRepository,
} from '@fluxer/api/src/admin/repositories/IAdminApiKeyRepository';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {BatchBuilder, Db, fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {AdminApiKeyRow} from '@fluxer/api/src/database/types/AdminAuthTypes';
import {AdminApiKey} from '@fluxer/api/src/models/AdminApiKey';
import {AdminApiKeys, AdminApiKeysByCreator} from '@fluxer/api/src/Tables';
import {hashPassword} from '@fluxer/api/src/utils/PasswordUtils';

function computeTtlSeconds(expiresAt: Date): number {
	const diffSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
	return Math.max(diffSeconds, 1);
}

export class AdminApiKeyRepository implements IAdminApiKeyRepository {
	async create(data: CreateAdminApiKeyData, createdBy: UserID, keyId: bigint, rawKey: string): Promise<AdminApiKey> {
		const keyHash = await hashPassword(rawKey);
		const createdAt = new Date();

		const row: AdminApiKeyRow = {
			key_id: keyId,
			key_hash: keyHash,
			name: data.name,
			created_by_user_id: createdBy,
			created_at: createdAt,
			last_used_at: null,
			expires_at: data.expiresAt,
			version: 1,
			acls: data.acls,
		};

		const batch = new BatchBuilder();

		if (data.expiresAt) {
			const ttlSeconds = computeTtlSeconds(data.expiresAt);
			batch.addPrepared(AdminApiKeys.insertWithTtl(row, ttlSeconds));
			batch.addPrepared(
				AdminApiKeysByCreator.insertWithTtl(
					{
						created_by_user_id: row.created_by_user_id,
						key_id: row.key_id,
						created_at: row.created_at,
						name: row.name,
						expires_at: row.expires_at,
						last_used_at: row.last_used_at,
						version: row.version,
						acls: row.acls,
					},
					ttlSeconds,
				),
			);
		} else {
			batch.addPrepared(AdminApiKeys.upsertAll(row));
			batch.addPrepared(
				AdminApiKeysByCreator.upsertAll({
					created_by_user_id: row.created_by_user_id,
					key_id: row.key_id,
					created_at: row.created_at,
					name: row.name,
					expires_at: row.expires_at,
					last_used_at: row.last_used_at,
					version: row.version,
					acls: row.acls,
				}),
			);
		}

		await batch.execute();

		return new AdminApiKey(row);
	}

	async findById(keyId: bigint): Promise<AdminApiKey | null> {
		const query = AdminApiKeys.select({
			where: AdminApiKeys.where.eq('key_id'),
			limit: 1,
		});

		const row = await fetchOne<AdminApiKeyRow>(query.bind({key_id: keyId}));

		if (!row) {
			return null;
		}

		return new AdminApiKey(row);
	}

	async listByCreator(createdBy: UserID): Promise<Array<AdminApiKey>> {
		const query = AdminApiKeysByCreator.select({
			where: AdminApiKeysByCreator.where.eq('created_by_user_id'),
		});

		const indexRows = await fetchMany<{
			created_by_user_id: UserID;
			key_id: bigint;
		}>(query.bind({created_by_user_id: createdBy}));

		if (indexRows.length === 0) {
			return [];
		}

		const apiKeys = await Promise.all(indexRows.map((row) => this.findById(row.key_id)));

		return apiKeys.filter((key) => key !== null) as Array<AdminApiKey>;
	}

	async updateLastUsed(keyId: bigint): Promise<void> {
		const patchQuery = AdminApiKeys.patchByPk({key_id: keyId}, {last_used_at: Db.set(new Date())});

		await upsertOne(patchQuery);
	}

	async revoke(keyId: bigint, createdBy: UserID): Promise<void> {
		const batch = new BatchBuilder();

		batch.addPrepared(AdminApiKeys.deleteByPk({key_id: keyId}));
		batch.addPrepared(AdminApiKeysByCreator.deleteByPk({created_by_user_id: createdBy, key_id: keyId}));

		await batch.execute();
	}
}
