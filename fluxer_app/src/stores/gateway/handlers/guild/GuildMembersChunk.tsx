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

import {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import MemberSearchStore from '@app/stores/MemberSearchStore';
import PermissionStore from '@app/stores/PermissionStore';
import TransientPresenceStore from '@app/stores/TransientPresenceStore';
import UserStore from '@app/stores/UserStore';
import type {PresenceRecord} from '@app/types/gateway/GatewayPresenceTypes';
import type {StatusType} from '@fluxer/constants/src/StatusConstants';
import {normalizeStatus} from '@fluxer/constants/src/StatusConstants';
import type {GuildMemberData} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {User} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

interface GuildMembersChunkPayload {
	guild_id: string;
	members: ReadonlyArray<GuildMemberData>;
	chunk_index: number;
	chunk_count: number;
	not_found?: ReadonlyArray<string>;
	presences?: ReadonlyArray<PresenceRecord>;
	nonce?: string;
}

export function handleGuildMembersChunk(data: GuildMembersChunkPayload, _context: GatewayHandlerContext): void {
	const {guild_id: guildId, members, chunk_index: chunkIndex, chunk_count: chunkCount, presences, nonce} = data;
	const currentUserId = AuthenticationStore.currentUserId;

	for (const member of members) {
		UserStore.handleUserUpdate(member.user as User);
	}

	GuildMemberStore.handleMembersChunk({
		guildId,
		members: members as Array<GuildMemberData>,
		chunkIndex,
		chunkCount,
		nonce,
	});

	if (currentUserId != null && members.some((member) => member.user.id === currentUserId)) {
		PermissionStore.handleGuildMemberUpdate(currentUserId);
		GuildReadStateStore.handleGuildMemberUpdate(currentUserId, guildId);
	}

	const memberRecords = members.map((member) => new GuildMemberRecord(guildId, member));
	MemberSearchStore.handleMembersChunk(guildId, memberRecords);

	if (presences) {
		const updates: Array<{userId: string; status: StatusType}> = [];
		for (const presence of presences) {
			const userId = presence.user?.id;
			const status = presence.status ? normalizeStatus(presence.status) : null;
			if (userId && status) {
				updates.push({userId, status});
			}
		}
		if (updates.length > 0) {
			TransientPresenceStore.updatePresences(updates);
		}
	}
}
