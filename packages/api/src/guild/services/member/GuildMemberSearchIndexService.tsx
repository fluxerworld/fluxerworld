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
import {Logger} from '@fluxer/api/src/Logger';
import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {User} from '@fluxer/api/src/models/User';
import {getGuildMemberSearchService} from '@fluxer/api/src/SearchFactory';

export class GuildMemberSearchIndexService {
	async indexMember(member: GuildMember, user: User): Promise<void> {
		try {
			const searchService = getGuildMemberSearchService();
			if (!searchService) {
				return;
			}
			await searchService.indexMember(member, user);
		} catch (error) {
			Logger.error(
				{
					guildId: member.guildId.toString(),
					userId: member.userId.toString(),
					error,
				},
				'Failed to index guild member in search',
			);
		}
	}

	async updateMember(member: GuildMember, user: User): Promise<void> {
		try {
			const searchService = getGuildMemberSearchService();
			if (!searchService) {
				return;
			}
			await searchService.updateMember(member, user);
		} catch (error) {
			Logger.error(
				{
					guildId: member.guildId.toString(),
					userId: member.userId.toString(),
					error,
				},
				'Failed to update guild member in search index',
			);
		}
	}

	async deleteMember(guildId: GuildID, userId: UserID): Promise<void> {
		try {
			const searchService = getGuildMemberSearchService();
			if (!searchService) {
				return;
			}
			await searchService.deleteMember(guildId, userId);
		} catch (error) {
			Logger.error(
				{
					guildId: guildId.toString(),
					userId: userId.toString(),
					error,
				},
				'Failed to delete guild member from search index',
			);
		}
	}
}
