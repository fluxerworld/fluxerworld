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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {AdminApiKeyRow} from '@fluxer/api/src/database/types/AdminAuthTypes';

export class AdminApiKey {
	readonly keyId: bigint;
	readonly keyHash: string;
	readonly name: string;
	readonly createdById: UserID;
	readonly createdAt: Date;
	readonly lastUsedAt: Date | null;
	readonly expiresAt: Date | null;
	readonly version: number;
	readonly acls: Set<string>;

	constructor(row: AdminApiKeyRow) {
		this.keyId = row.key_id;
		this.keyHash = row.key_hash;
		this.name = row.name;
		this.createdById = row.created_by_user_id;
		this.createdAt = row.created_at;
		this.lastUsedAt = row.last_used_at ?? null;
		this.expiresAt = row.expires_at ?? null;
		this.version = row.version;
		this.acls = row.acls ?? new Set();
	}

	toRow(): AdminApiKeyRow {
		return {
			key_id: this.keyId,
			key_hash: this.keyHash,
			name: this.name,
			created_by_user_id: this.createdById,
			created_at: this.createdAt,
			last_used_at: this.lastUsedAt,
			expires_at: this.expiresAt,
			version: this.version,
			acls: this.acls.size > 0 ? this.acls : new Set(),
		};
	}

	isExpired(): boolean {
		if (!this.expiresAt) {
			return false;
		}
		return this.expiresAt < new Date();
	}
}
