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
import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {User} from '@fluxer/api/src/models/User';
import type {
	ISearchAdapter as SchemaISearchAdapter,
	SearchResult as SchemaSearchResult,
} from '@fluxer/schema/src/contracts/search/SearchAdapterTypes';
import type {
	GuildMemberSearchFilters,
	SearchableGuildMember,
} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';

export interface IGuildMemberSearchService
	extends SchemaISearchAdapter<GuildMemberSearchFilters, SearchableGuildMember> {
	indexMember(member: GuildMember, user: User): Promise<void>;
	indexMembers(members: Array<{member: GuildMember; user: User}>): Promise<void>;
	updateMember(member: GuildMember, user: User): Promise<void>;
	deleteMember(guildId: GuildID, userId: UserID): Promise<void>;
	deleteGuildMembers(guildId: GuildID): Promise<void>;
	searchMembers(
		query: string,
		filters: GuildMemberSearchFilters,
		options?: {limit?: number; offset?: number},
	): Promise<SchemaSearchResult<SearchableGuildMember>>;
}
