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

type Nullish<T> = T | null;

export interface AdminApiKeyRow {
	key_id: bigint;
	key_hash: string;
	name: string;
	created_by_user_id: UserID;
	created_at: Date;
	last_used_at: Nullish<Date>;
	expires_at: Nullish<Date>;
	version: number;
	acls: Nullish<Set<string>>;
}

export interface AdminApiKeyByCreatorRow {
	created_by_user_id: UserID;
	key_id: bigint;
	created_at: Date;
	name: string;
	expires_at: Nullish<Date>;
	last_used_at: Nullish<Date>;
	version: number;
	acls: Nullish<Set<string>>;
}

export const ADMIN_API_KEY_COLUMNS = [
	'key_id',
	'key_hash',
	'name',
	'created_by_user_id',
	'created_at',
	'last_used_at',
	'expires_at',
	'version',
	'acls',
] as const satisfies ReadonlyArray<keyof AdminApiKeyRow>;

export const ADMIN_API_KEY_BY_CREATOR_COLUMNS = [
	'created_by_user_id',
	'key_id',
	'created_at',
	'name',
	'expires_at',
	'last_used_at',
	'version',
	'acls',
] as const satisfies ReadonlyArray<keyof AdminApiKeyByCreatorRow>;
