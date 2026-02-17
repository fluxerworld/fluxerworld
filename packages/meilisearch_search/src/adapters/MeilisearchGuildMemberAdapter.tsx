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

import {MeilisearchIndexAdapter} from '@fluxer/meilisearch_search/src/adapters/MeilisearchIndexAdapter';
import {
	compactFilters,
	type MeilisearchFilter,
	meiliAndEquals,
	meiliEquals,
	meiliGte,
	meiliLte,
	meiliOrEquals,
} from '@fluxer/meilisearch_search/src/MeilisearchFilterUtils';
import {MEILISEARCH_INDEX_DEFINITIONS} from '@fluxer/meilisearch_search/src/MeilisearchIndexDefinitions';
import type {
	GuildMemberSearchFilters,
	SearchableGuildMember,
} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import type {MeiliSearch} from 'meilisearch';

function buildGuildMemberFilters(filters: GuildMemberSearchFilters): Array<MeilisearchFilter | undefined> {
	const clauses: Array<MeilisearchFilter | undefined> = [];

	clauses.push(meiliEquals('guildId', filters.guildId));

	if (filters.roleIds && filters.roleIds.length > 0) {
		// "All roles" semantics: every role id must be present.
		clauses.push(...meiliAndEquals('roleIds', filters.roleIds));
	}

	if (filters.joinedAtGte !== undefined) clauses.push(meiliGte('joinedAt', filters.joinedAtGte));
	if (filters.joinedAtLte !== undefined) clauses.push(meiliLte('joinedAt', filters.joinedAtLte));

	if (filters.joinSourceType && filters.joinSourceType.length > 0) {
		clauses.push(meiliOrEquals('joinSourceType', filters.joinSourceType));
	}

	if (filters.sourceInviteCode && filters.sourceInviteCode.length > 0) {
		clauses.push(meiliOrEquals('sourceInviteCode', filters.sourceInviteCode));
	}

	if (filters.userCreatedAtGte !== undefined) clauses.push(meiliGte('userCreatedAt', filters.userCreatedAtGte));
	if (filters.userCreatedAtLte !== undefined) clauses.push(meiliLte('userCreatedAt', filters.userCreatedAtLte));

	if (filters.isBot !== undefined) clauses.push(meiliEquals('isBot', filters.isBot));

	return compactFilters(clauses);
}

function buildGuildMemberSort(filters: GuildMemberSearchFilters): Array<string> | undefined {
	const sortBy = filters.sortBy ?? 'joinedAt';
	if (sortBy === 'relevance') return undefined;
	const sortOrder = filters.sortOrder ?? 'desc';
	return [`${sortBy}:${sortOrder}`];
}

export interface MeilisearchGuildMemberAdapterOptions {
	client: MeiliSearch;
	waitForTasks: {
		enabled: boolean;
		timeoutMs: number;
		intervalMs: number;
	};
}

export class MeilisearchGuildMemberAdapter extends MeilisearchIndexAdapter<
	GuildMemberSearchFilters,
	SearchableGuildMember
> {
	constructor(options: MeilisearchGuildMemberAdapterOptions) {
		super({
			client: options.client,
			index: MEILISEARCH_INDEX_DEFINITIONS.guild_members,
			buildFilters: buildGuildMemberFilters,
			buildSort: buildGuildMemberSort,
			waitForTasks: options.waitForTasks,
		});
	}
}
