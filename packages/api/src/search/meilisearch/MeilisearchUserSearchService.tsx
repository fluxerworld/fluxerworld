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
import type {User} from '@fluxer/api/src/models/User';
import type {IUserSearchService} from '@fluxer/api/src/search/IUserSearchService';
import {MeilisearchSearchServiceBase} from '@fluxer/api/src/search/meilisearch/MeilisearchSearchServiceBase';
import {convertToSearchableUser} from '@fluxer/api/src/search/user/UserSearchSerializer';
import type {MeilisearchUserAdapterOptions} from '@fluxer/meilisearch_search/src/adapters/MeilisearchUserAdapter';
import {MeilisearchUserAdapter} from '@fluxer/meilisearch_search/src/adapters/MeilisearchUserAdapter';
import type {SearchResult as SchemaSearchResult} from '@fluxer/schema/src/contracts/search/SearchAdapterTypes';
import type {SearchableUser, UserSearchFilters} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';

export interface MeilisearchUserSearchServiceOptions extends MeilisearchUserAdapterOptions {}

export class MeilisearchUserSearchService
	extends MeilisearchSearchServiceBase<UserSearchFilters, SearchableUser, MeilisearchUserAdapter>
	implements IUserSearchService
{
	constructor(options: MeilisearchUserSearchServiceOptions) {
		super(new MeilisearchUserAdapter(options));
	}

	async indexUser(user: User): Promise<void> {
		await this.indexDocument(convertToSearchableUser(user));
	}

	async indexUsers(users: Array<User>): Promise<void> {
		if (users.length === 0) return;
		await this.indexDocuments(users.map(convertToSearchableUser));
	}

	async updateUser(user: User): Promise<void> {
		await this.updateDocument(convertToSearchableUser(user));
	}

	async deleteUser(userId: UserID): Promise<void> {
		await this.deleteDocument(userId.toString());
	}

	async deleteUsers(userIds: Array<UserID>): Promise<void> {
		await this.deleteDocuments(userIds.map((id) => id.toString()));
	}

	searchUsers(
		query: string,
		filters: UserSearchFilters,
		options?: {limit?: number; offset?: number},
	): Promise<SchemaSearchResult<SearchableUser>> {
		return this.search(query, filters, options);
	}
}
