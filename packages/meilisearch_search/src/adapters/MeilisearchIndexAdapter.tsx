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

import type {MeilisearchFilter} from '@fluxer/meilisearch_search/src/MeilisearchFilterUtils';
import {compactFilters} from '@fluxer/meilisearch_search/src/MeilisearchFilterUtils';
import type {MeilisearchIndexDefinition} from '@fluxer/meilisearch_search/src/MeilisearchIndexDefinitions';
import type {ISearchAdapter, SearchOptions, SearchResult} from '@fluxer/schema/src/contracts/search/SearchAdapterTypes';
import type {Index, MeiliSearch, Settings} from 'meilisearch';

export interface MeilisearchIndexAdapterOptions<TFilters> {
	client: MeiliSearch;
	index: MeilisearchIndexDefinition;
	buildFilters: (filters: TFilters) => Array<MeilisearchFilter | undefined>;
	buildSort?: (filters: TFilters) => Array<string> | undefined;
	waitForTasks: {
		enabled: boolean;
		timeoutMs: number;
		intervalMs: number;
	};
}

function normalizeSettingsValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return [...value].sort();
	}
	return value;
}

function areSettingsEquivalent(a: Settings, b: Settings): boolean {
	// Only compare the settings we actively manage.
	const keys: Array<keyof Settings> = ['filterableAttributes', 'sortableAttributes', 'searchableAttributes'];
	for (const key of keys) {
		const left = normalizeSettingsValue(a[key]);
		const right = normalizeSettingsValue(b[key]);
		if (JSON.stringify(left) !== JSON.stringify(right)) {
			return false;
		}
	}
	return true;
}

function getTaskUid(result: unknown): number | null {
	if (!result || typeof result !== 'object') {
		return null;
	}
	const obj = result as Record<string, unknown>;
	const uid = obj.taskUid ?? obj.uid;
	return typeof uid === 'number' ? uid : null;
}

export class MeilisearchIndexAdapter<TFilters, TResult extends {id: string}>
	implements ISearchAdapter<TFilters, TResult>
{
	private readonly client: MeiliSearch;
	private readonly indexDefinition: MeilisearchIndexDefinition;
	private readonly buildFilters: (filters: TFilters) => Array<MeilisearchFilter | undefined>;
	private readonly buildSort: ((filters: TFilters) => Array<string> | undefined) | undefined;
	private readonly waitForTasks: MeilisearchIndexAdapterOptions<TFilters>['waitForTasks'];

	private index: Index<TResult> | null = null;
	private initialized = false;

	constructor(options: MeilisearchIndexAdapterOptions<TFilters>) {
		this.client = options.client;
		this.indexDefinition = options.index;
		this.buildFilters = options.buildFilters;
		this.buildSort = options.buildSort;
		this.waitForTasks = options.waitForTasks;
	}

	async initialize(): Promise<void> {
		const indexName = this.indexDefinition.indexName;
		const primaryKey = this.indexDefinition.primaryKey;

		const index = this.client.index<TResult>(indexName);
		try {
			await index.getRawInfo();
		} catch (error) {
			// meilisearch-js throws a MeiliSearchApiError with the following shape:
			// - error.response.status (HTTP status)
			// - error.cause.code (Meilisearch error code)
			const err = error as {
				response?: {status?: unknown};
				cause?: {code?: unknown; errorCode?: unknown};
				code?: unknown;
				errorCode?: unknown;
				status?: unknown;
				statusCode?: unknown;
			};
			const maybeStatus =
				err.response?.status ??
				err.status ??
				err.statusCode ??
				(err as {response?: {statusCode?: unknown}}).response?.statusCode;
			const maybeCode = err.cause?.code ?? err.code;
			const maybeErrorCode = err.cause?.errorCode ?? err.errorCode;

			const isNotFound =
				maybeStatus === 404 ||
				maybeStatus === '404' ||
				maybeCode === 'index_not_found' ||
				maybeErrorCode === 'index_not_found';
			if (!isNotFound) {
				throw error;
			}

			try {
				const createResult = await this.client.createIndex(indexName, {primaryKey});
				await this.waitForTaskIfEnabled(createResult);
			} catch (createError) {
				// If multiple processes race to create the index, ignore "already exists" errors.
				const createErr = createError as {
					response?: {status?: unknown};
					cause?: {code?: unknown; errorCode?: unknown};
					code?: unknown;
					errorCode?: unknown;
				};
				const createCode = createErr.cause?.code ?? createErr.code;
				const createErrorCode = createErr.cause?.errorCode ?? createErr.errorCode;
				const isAlreadyExists = createCode === 'index_already_exists' || createErrorCode === 'index_already_exists';
				if (!isAlreadyExists) {
					throw createError;
				}
			}
		}

		this.index = this.client.index<TResult>(indexName);

		const desiredSettings: Settings = {
			filterableAttributes: this.indexDefinition.filterableAttributes,
			sortableAttributes: this.indexDefinition.sortableAttributes,
			searchableAttributes: this.indexDefinition.searchableAttributes,
		};

		const currentSettings = await this.index.getSettings();
		if (!areSettingsEquivalent(currentSettings, desiredSettings)) {
			const updateResult = await this.index.updateSettings(desiredSettings);
			await this.waitForTaskIfEnabled(updateResult);
		}

		this.initialized = true;
	}

	async shutdown(): Promise<void> {
		this.initialized = false;
		this.index = null;
	}

	isAvailable(): boolean {
		return this.initialized && this.index !== null;
	}

	async indexDocument(doc: TResult): Promise<void> {
		await this.indexDocuments([doc]);
	}

	async indexDocuments(docs: Array<TResult>): Promise<void> {
		if (docs.length === 0) {
			return;
		}
		if (!this.index) {
			throw new Error('Meilisearch adapter not initialised');
		}
		const result = await this.index.addDocuments(docs);
		await this.waitForTaskIfEnabled(result);
	}

	async updateDocument(doc: TResult): Promise<void> {
		// Meilisearch uses addDocuments as an upsert.
		await this.indexDocuments([doc]);
	}

	async deleteDocument(id: string): Promise<void> {
		await this.deleteDocuments([id]);
	}

	async deleteDocuments(ids: Array<string>): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		if (!this.index) {
			throw new Error('Meilisearch adapter not initialised');
		}
		const result = await this.index.deleteDocuments(ids);
		await this.waitForTaskIfEnabled(result);
	}

	async deleteAllDocuments(): Promise<void> {
		if (!this.index) {
			throw new Error('Meilisearch adapter not initialised');
		}
		const result = await this.index.deleteAllDocuments();
		await this.waitForTaskIfEnabled(result);
	}

	async search(query: string, filters: TFilters, options?: SearchOptions): Promise<SearchResult<TResult>> {
		if (!this.index) {
			throw new Error('Meilisearch adapter not initialised');
		}

		const limit = options?.limit ?? options?.hitsPerPage ?? 25;
		const offset = options?.offset ?? (options?.page ? (options.page - 1) * (options.hitsPerPage ?? 25) : 0);

		const filter = compactFilters(this.buildFilters(filters));
		const sort = this.buildSort?.(filters);

		const result = await this.index.search<TResult>(query, {
			limit,
			offset,
			filter: filter.length > 0 ? filter : undefined,
			sort: sort && sort.length > 0 ? sort : undefined,
		});

		const total = result.estimatedTotalHits ?? result.hits.length;

		return {hits: result.hits, total};
	}

	protected async waitForTaskIfEnabled(result: unknown): Promise<void> {
		if (!this.waitForTasks.enabled) {
			return;
		}
		const taskUid = getTaskUid(result);
		if (taskUid == null) {
			return;
		}
		const task = await this.client.tasks.waitForTask(taskUid, {
			timeout: this.waitForTasks.timeoutMs,
			interval: this.waitForTasks.intervalMs,
		});

		// meilisearch-js resolves even when the task failed; it returns a Task
		// object with status "failed" and error details.
		const status = (task as {status?: unknown}).status;
		if (status === 'failed' || status === 'canceled') {
			const error = (task as {error?: {message?: unknown; code?: unknown}}).error;
			const message =
				typeof error?.message === 'string'
					? error.message
					: `Meilisearch task ${taskUid} finished with status ${String(status)}`;
			throw new Error(message);
		}
	}
}
