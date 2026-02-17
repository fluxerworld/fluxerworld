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
import type {
	ISearchAdapter as SchemaISearchAdapter,
	SearchResult as SchemaSearchResult,
} from '@fluxer/schema/src/contracts/search/SearchAdapterTypes';
import type {SearchableUser, UserSearchFilters} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';

export interface IUserSearchService extends SchemaISearchAdapter<UserSearchFilters, SearchableUser> {
	indexUser(user: User): Promise<void>;
	indexUsers(users: Array<User>): Promise<void>;
	updateUser(user: User): Promise<void>;
	deleteUser(userId: UserID): Promise<void>;
	deleteUsers(userIds: Array<UserID>): Promise<void>;
	searchUsers(
		query: string,
		filters: UserSearchFilters,
		options?: {limit?: number; offset?: number},
	): Promise<SchemaSearchResult<SearchableUser>>;
}
