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

import type {GuildID, UserID} from '@fluxer/api/src/BrandedTypes';

type Nullish<T> = T | null;

export interface GuildDiscoveryRow {
	guild_id: GuildID;
	status: string;
	category_type: number;
	description: string;
	applied_at: Date;
	reviewed_at: Nullish<Date>;
	reviewed_by: Nullish<UserID>;
	review_reason: Nullish<string>;
	removed_at: Nullish<Date>;
	removed_by: Nullish<UserID>;
	removal_reason: Nullish<string>;
}

export const GUILD_DISCOVERY_COLUMNS = [
	'guild_id',
	'status',
	'category_type',
	'description',
	'applied_at',
	'reviewed_at',
	'reviewed_by',
	'review_reason',
	'removed_at',
	'removed_by',
	'removal_reason',
] as const satisfies ReadonlyArray<keyof GuildDiscoveryRow>;

export interface GuildDiscoveryByStatusRow {
	status: string;
	applied_at: Date;
	guild_id: GuildID;
}

export const GUILD_DISCOVERY_BY_STATUS_COLUMNS = ['status', 'applied_at', 'guild_id'] as const satisfies ReadonlyArray<
	keyof GuildDiscoveryByStatusRow
>;
