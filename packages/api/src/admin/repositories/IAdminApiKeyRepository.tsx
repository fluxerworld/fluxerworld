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
import type {AdminApiKey} from '@fluxer/api/src/models/AdminApiKey';

export interface CreateAdminApiKeyData {
	name: string;
	expiresAt: Date | null;
	acls: Set<string>;
}

export interface IAdminApiKeyRepository {
	create(data: CreateAdminApiKeyData, createdBy: UserID, keyId: bigint, rawKey: string): Promise<AdminApiKey>;
	findById(keyId: bigint): Promise<AdminApiKey | null>;
	listByCreator(createdBy: UserID): Promise<Array<AdminApiKey>>;
	updateLastUsed(keyId: bigint): Promise<void>;
	revoke(keyId: bigint, createdBy: UserID): Promise<void>;
}
