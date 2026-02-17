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
	meiliEquals,
} from '@fluxer/meilisearch_search/src/MeilisearchFilterUtils';
import {MEILISEARCH_INDEX_DEFINITIONS} from '@fluxer/meilisearch_search/src/MeilisearchIndexDefinitions';
import type {AuditLogSearchFilters, SearchableAuditLog} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import type {MeiliSearch} from 'meilisearch';

function buildAuditLogFilters(filters: AuditLogSearchFilters): Array<MeilisearchFilter | undefined> {
	const clauses: Array<MeilisearchFilter | undefined> = [];

	if (filters.adminUserId) clauses.push(meiliEquals('adminUserId', filters.adminUserId));
	if (filters.targetType) clauses.push(meiliEquals('targetType', filters.targetType));
	if (filters.targetId) clauses.push(meiliEquals('targetId', filters.targetId));
	if (filters.action) clauses.push(meiliEquals('action', filters.action));

	return compactFilters(clauses);
}

function buildAuditLogSort(filters: AuditLogSearchFilters): Array<string> | undefined {
	const sortBy = filters.sortBy ?? 'createdAt';
	if (sortBy === 'relevance') return undefined;
	const sortOrder = filters.sortOrder ?? 'desc';
	return [`createdAt:${sortOrder}`];
}

export interface MeilisearchAuditLogAdapterOptions {
	client: MeiliSearch;
	waitForTasks: {
		enabled: boolean;
		timeoutMs: number;
		intervalMs: number;
	};
}

export class MeilisearchAuditLogAdapter extends MeilisearchIndexAdapter<AuditLogSearchFilters, SearchableAuditLog> {
	constructor(options: MeilisearchAuditLogAdapterOptions) {
		super({
			client: options.client,
			index: MEILISEARCH_INDEX_DEFINITIONS.audit_logs,
			buildFilters: buildAuditLogFilters,
			buildSort: buildAuditLogSort,
			waitForTasks: options.waitForTasks,
		});
	}
}
