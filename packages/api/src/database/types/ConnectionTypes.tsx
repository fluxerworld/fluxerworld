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
import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';

type Nullish<T> = T | null;

export interface UserConnectionRow {
	user_id: UserID;
	connection_id: string;
	connection_type: ConnectionType;
	identifier: string;
	name: string;
	verified: boolean;
	visibility_flags: number;
	sort_order: number;
	verification_token: string;
	verified_at: Nullish<Date>;
	last_verified_at: Nullish<Date>;
	created_at: Date;
	version: number;
}

export const USER_CONNECTION_COLUMNS = [
	'user_id',
	'connection_id',
	'connection_type',
	'identifier',
	'name',
	'verified',
	'visibility_flags',
	'sort_order',
	'verification_token',
	'verified_at',
	'last_verified_at',
	'created_at',
	'version',
] as const satisfies ReadonlyArray<keyof UserConnectionRow>;
