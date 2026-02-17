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

import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import GuildStore from '@app/stores/GuildStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import PermissionStore from '@app/stores/PermissionStore';

interface GuildRoleDeletePayload {
	guild_id: string;
	role_id: string;
}

export function handleGuildRoleDelete(data: GuildRoleDeletePayload, _context: GatewayHandlerContext): void {
	GuildStore.handleGuildRoleDelete({guildId: data.guild_id, roleId: data.role_id});
	GuildMemberStore.handleGuildRoleDelete(data.guild_id, data.role_id);
	ChannelStore.handleGuildRoleDelete({guildId: data.guild_id, roleId: data.role_id});
	PermissionStore.handleGuildRole(data.guild_id);
	GuildReadStateStore.handleGuildUpdate(data.guild_id);
}
