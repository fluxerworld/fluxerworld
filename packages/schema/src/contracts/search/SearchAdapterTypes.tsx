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

export interface SearchOptions {
	hitsPerPage?: number;
	page?: number;
	limit?: number;
	offset?: number;
}

export interface SearchResult<TResult> {
	hits: Array<TResult>;
	total: number;
}

export interface ISearchAdapter<TFilters, TResult> {
	initialize(): Promise<void>;
	shutdown(): Promise<void>;
	indexDocument(doc: TResult): Promise<void>;
	indexDocuments(docs: Array<TResult>): Promise<void>;
	updateDocument(doc: TResult): Promise<void>;
	deleteDocument(id: string): Promise<void>;
	deleteDocuments(ids: Array<string>): Promise<void>;
	deleteAllDocuments(): Promise<void>;
	search(query: string, filters: TFilters, options?: SearchOptions): Promise<SearchResult<TResult>>;
	isAvailable(): boolean;
}
