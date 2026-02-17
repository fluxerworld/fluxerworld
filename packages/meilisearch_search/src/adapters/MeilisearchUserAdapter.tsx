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
	meiliIsNotNull,
	meiliIsNull,
	meiliLte,
} from '@fluxer/meilisearch_search/src/MeilisearchFilterUtils';
import {MEILISEARCH_INDEX_DEFINITIONS} from '@fluxer/meilisearch_search/src/MeilisearchIndexDefinitions';
import type {SearchableUser, UserSearchFilters} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import type {MeiliSearch} from 'meilisearch';

function buildUserFilters(filters: UserSearchFilters): Array<MeilisearchFilter | undefined> {
	const clauses: Array<MeilisearchFilter | undefined> = [];

	if (filters.isBot !== undefined) clauses.push(meiliEquals('isBot', filters.isBot));
	if (filters.isSystem !== undefined) clauses.push(meiliEquals('isSystem', filters.isSystem));
	if (filters.emailVerified !== undefined) clauses.push(meiliEquals('emailVerified', filters.emailVerified));
	if (filters.emailBounced !== undefined) clauses.push(meiliEquals('emailBounced', filters.emailBounced));

	if (filters.hasPremium !== undefined) {
		clauses.push(filters.hasPremium ? meiliIsNotNull('premiumType') : meiliIsNull('premiumType'));
	}
	if (filters.isTempBanned !== undefined) {
		clauses.push(filters.isTempBanned ? meiliIsNotNull('tempBannedUntil') : meiliIsNull('tempBannedUntil'));
	}
	if (filters.isPendingDeletion !== undefined) {
		clauses.push(filters.isPendingDeletion ? meiliIsNotNull('pendingDeletionAt') : meiliIsNull('pendingDeletionAt'));
	}

	if (filters.hasAcl && filters.hasAcl.length > 0) {
		clauses.push(...meiliAndEquals('acls', filters.hasAcl));
	}

	if (filters.minSuspiciousActivityFlags !== undefined) {
		clauses.push(meiliGte('suspiciousActivityFlags', filters.minSuspiciousActivityFlags));
	}

	if (filters.createdAtGreaterThanOrEqual !== undefined) {
		clauses.push(meiliGte('createdAt', filters.createdAtGreaterThanOrEqual));
	}
	if (filters.createdAtLessThanOrEqual !== undefined) {
		clauses.push(meiliLte('createdAt', filters.createdAtLessThanOrEqual));
	}

	return compactFilters(clauses);
}

function buildUserSort(filters: UserSearchFilters): Array<string> | undefined {
	const sortBy = filters.sortBy ?? 'createdAt';
	if (sortBy === 'relevance') return undefined;
	const sortOrder = filters.sortOrder ?? 'desc';
	return [`${sortBy}:${sortOrder}`];
}

export interface MeilisearchUserAdapterOptions {
	client: MeiliSearch;
	waitForTasks: {
		enabled: boolean;
		timeoutMs: number;
		intervalMs: number;
	};
}

export class MeilisearchUserAdapter extends MeilisearchIndexAdapter<UserSearchFilters, SearchableUser> {
	constructor(options: MeilisearchUserAdapterOptions) {
		super({
			client: options.client,
			index: MEILISEARCH_INDEX_DEFINITIONS.users,
			buildFilters: buildUserFilters,
			buildSort: buildUserSort,
			waitForTasks: options.waitForTasks,
		});
	}
}
