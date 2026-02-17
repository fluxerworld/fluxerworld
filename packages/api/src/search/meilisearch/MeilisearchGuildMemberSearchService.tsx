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
import {convertToSearchableGuildMember} from '@fluxer/api/src/search/guild_member/GuildMemberSearchSerializer';
import type {IGuildMemberSearchService} from '@fluxer/api/src/search/IGuildMemberSearchService';
import {MeilisearchSearchServiceBase} from '@fluxer/api/src/search/meilisearch/MeilisearchSearchServiceBase';
import type {MeilisearchGuildMemberAdapterOptions} from '@fluxer/meilisearch_search/src/adapters/MeilisearchGuildMemberAdapter';
import {MeilisearchGuildMemberAdapter} from '@fluxer/meilisearch_search/src/adapters/MeilisearchGuildMemberAdapter';
import type {SearchResult as SchemaSearchResult} from '@fluxer/schema/src/contracts/search/SearchAdapterTypes';
import type {
	GuildMemberSearchFilters,
	SearchableGuildMember,
} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';

const DEFAULT_LIMIT = 25;

function toSearchOptions(options?: {limit?: number; offset?: number}): {limit?: number; offset?: number} {
	return {
		limit: options?.limit ?? DEFAULT_LIMIT,
		offset: options?.offset ?? 0,
	};
}

export interface MeilisearchGuildMemberSearchServiceOptions extends MeilisearchGuildMemberAdapterOptions {}

export class MeilisearchGuildMemberSearchService
	extends MeilisearchSearchServiceBase<GuildMemberSearchFilters, SearchableGuildMember, MeilisearchGuildMemberAdapter>
	implements IGuildMemberSearchService
{
	constructor(options: MeilisearchGuildMemberSearchServiceOptions) {
		super(new MeilisearchGuildMemberAdapter(options));
	}

	async indexMember(member: GuildMember, user: User): Promise<void> {
		await this.indexDocument(convertToSearchableGuildMember(member, user));
	}

	async indexMembers(members: Array<{member: GuildMember; user: User}>): Promise<void> {
		if (members.length === 0) return;
		await this.indexDocuments(members.map(({member, user}) => convertToSearchableGuildMember(member, user)));
	}

	async updateMember(member: GuildMember, user: User): Promise<void> {
		await this.updateDocument(convertToSearchableGuildMember(member, user));
	}

	async deleteMember(guildId: GuildID, userId: UserID): Promise<void> {
		await this.deleteDocument(`${guildId}_${userId}`);
	}

	async deleteGuildMembers(guildId: GuildID): Promise<void> {
		const guildIdString = guildId.toString();
		while (true) {
			const result = await this.search('', {guildId: guildIdString}, {limit: 1000, offset: 0});
			if (result.hits.length === 0) {
				return;
			}
			await this.deleteDocuments(result.hits.map((hit) => hit.id));
		}
	}

	searchMembers(
		query: string,
		filters: GuildMemberSearchFilters,
		options?: {limit?: number; offset?: number},
	): Promise<SchemaSearchResult<SearchableGuildMember>> {
		return this.search(query, filters, toSearchOptions(options));
	}
}
