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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import type {GuildMemberData} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';

const logger = new Logger('GuildMembers');

export async function update(
	guildId: string,
	userId: string,
	params: Partial<GuildMemberData> & {channel_id?: string | null; connection_id?: string},
): Promise<void> {
	try {
		await http.patch({url: Endpoints.GUILD_MEMBER(guildId, userId), body: params});
		logger.debug(`Updated member ${userId} in guild ${guildId}`, {connection_id: params['connection_id']});
	} catch (error) {
		logger.error(`Failed to update member ${userId} in guild ${guildId}:`, error);
		throw error;
	}
}

export async function addRole(guildId: string, userId: string, roleId: string): Promise<void> {
	try {
		await http.put({url: Endpoints.GUILD_MEMBER_ROLE(guildId, userId, roleId)});
		logger.debug(`Added role ${roleId} to member ${userId} in guild ${guildId}`);
	} catch (error) {
		logger.error(`Failed to add role ${roleId} to member ${userId} in guild ${guildId}:`, error);
		throw error;
	}
}

export async function removeRole(guildId: string, userId: string, roleId: string): Promise<void> {
	try {
		await http.delete({url: Endpoints.GUILD_MEMBER_ROLE(guildId, userId, roleId)});
		logger.debug(`Removed role ${roleId} from member ${userId} in guild ${guildId}`);
	} catch (error) {
		logger.error(`Failed to remove role ${roleId} from member ${userId} in guild ${guildId}:`, error);
		throw error;
	}
}

export async function updateProfile(
	guildId: string,
	params: {
		avatar?: string | null;
		banner?: string | null;
		bio?: string | null;
		pronouns?: string | null;
		accent_color?: number | null;
		nick?: string | null;
		profile_flags?: number | null;
	},
): Promise<void> {
	try {
		await http.patch({url: Endpoints.GUILD_MEMBER(guildId), body: params});
		logger.debug(`Updated current user's per-guild profile in guild ${guildId}`);
	} catch (error) {
		logger.error(`Failed to update current user's per-guild profile in guild ${guildId}:`, error);
		throw error;
	}
}

export async function kick(guildId: string, userId: string): Promise<void> {
	try {
		await http.delete({url: Endpoints.GUILD_MEMBER(guildId, userId)});
		logger.debug(`Kicked member ${userId} from guild ${guildId}`);
	} catch (error) {
		logger.error(`Failed to kick member ${userId} from guild ${guildId}:`, error);
		throw error;
	}
}

export async function timeout(
	guildId: string,
	userId: string,
	communicationDisabledUntil: string | null,
	timeoutReason?: string | null,
): Promise<void> {
	try {
		const body: Record<string, string | null> = {
			communication_disabled_until: communicationDisabledUntil,
		};
		if (timeoutReason) {
			body.timeout_reason = timeoutReason;
		}
		await http.patch({
			url: Endpoints.GUILD_MEMBER(guildId, userId),
			body,
		});
		logger.debug(`Updated timeout for member ${userId} in guild ${guildId}`);
	} catch (error) {
		logger.error(`Failed to update timeout for member ${userId} in guild ${guildId}:`, error);
		throw error;
	}
}
