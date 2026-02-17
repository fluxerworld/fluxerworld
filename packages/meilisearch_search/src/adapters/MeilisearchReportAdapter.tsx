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
	meiliIsNotNull,
	meiliIsNull,
} from '@fluxer/meilisearch_search/src/MeilisearchFilterUtils';
import {MEILISEARCH_INDEX_DEFINITIONS} from '@fluxer/meilisearch_search/src/MeilisearchIndexDefinitions';
import type {ReportSearchFilters, SearchableReport} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import type {MeiliSearch} from 'meilisearch';

function buildReportFilters(filters: ReportSearchFilters): Array<MeilisearchFilter | undefined> {
	const clauses: Array<MeilisearchFilter | undefined> = [];

	if (filters.reporterId) clauses.push(meiliEquals('reporterId', filters.reporterId));
	if (filters.status !== undefined) clauses.push(meiliEquals('status', filters.status));
	if (filters.reportType !== undefined) clauses.push(meiliEquals('reportType', filters.reportType));
	if (filters.category) clauses.push(meiliEquals('category', filters.category));
	if (filters.reportedUserId) clauses.push(meiliEquals('reportedUserId', filters.reportedUserId));
	if (filters.reportedGuildId) clauses.push(meiliEquals('reportedGuildId', filters.reportedGuildId));
	if (filters.reportedMessageId) clauses.push(meiliEquals('reportedMessageId', filters.reportedMessageId));
	if (filters.guildContextId) clauses.push(meiliEquals('guildContextId', filters.guildContextId));
	if (filters.resolvedByAdminId) clauses.push(meiliEquals('resolvedByAdminId', filters.resolvedByAdminId));

	if (filters.isResolved !== undefined) {
		clauses.push(filters.isResolved ? meiliIsNotNull('resolvedAt') : meiliIsNull('resolvedAt'));
	}

	return compactFilters(clauses);
}

function buildReportSort(filters: ReportSearchFilters): Array<string> | undefined {
	const sortBy = filters.sortBy ?? 'reportedAt';
	if (sortBy === 'relevance') return undefined;
	const sortOrder = filters.sortOrder ?? 'desc';
	return [`${sortBy}:${sortOrder}`];
}

export interface MeilisearchReportAdapterOptions {
	client: MeiliSearch;
	waitForTasks: {
		enabled: boolean;
		timeoutMs: number;
		intervalMs: number;
	};
}

export class MeilisearchReportAdapter extends MeilisearchIndexAdapter<ReportSearchFilters, SearchableReport> {
	constructor(options: MeilisearchReportAdapterOptions) {
		super({
			client: options.client,
			index: MEILISEARCH_INDEX_DEFINITIONS.reports,
			buildFilters: buildReportFilters,
			buildSort: buildReportSort,
			waitForTasks: options.waitForTasks,
		});
	}
}
