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

import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {User} from '@fluxer/api/src/models/User';
import type {SearchableGuildMember} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import {extractTimestampFromSnowflake} from '@fluxer/snowflake/src/SnowflakeUtils';

export function convertToSearchableGuildMember(member: GuildMember, user: User): SearchableGuildMember {
	return {
		id: `${member.guildId}_${member.userId}`,
		guildId: member.guildId.toString(),
		userId: member.userId.toString(),
		username: user.username,
		discriminator: String(user.discriminator).padStart(4, '0'),
		globalName: user.globalName ?? null,
		nickname: member.nickname,
		roleIds: Array.from(member.roleIds).map((id) => id.toString()),
		joinedAt: Math.floor(member.joinedAt.getTime() / 1000),
		joinSourceType: member.joinSourceType,
		sourceInviteCode: member.sourceInviteCode?.toString() ?? null,
		inviterId: member.inviterId?.toString() ?? null,
		userCreatedAt: Math.floor(extractTimestampFromSnowflake(member.userId.toString()) / 1000),
		isBot: user.isBot,
	};
}
