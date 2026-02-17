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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {ApiClient, type ApiResult} from '@fluxer/admin/src/api/Client';
import type {JsonObject} from '@fluxer/admin/src/api/JsonTypes';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {
	ListGuildMembersResponse,
	LookupGuildResponse,
	SearchGuildsResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

export type GuildLookupResult = NonNullable<z.infer<typeof LookupGuildResponse>['guild']>;
export type GuildChannel = GuildLookupResult['channels'][number];
export type GuildRole = GuildLookupResult['roles'][number];

export interface UpdateGuildSettingsOptions {
	verification_level?: number | undefined;
	mfa_level?: number | undefined;
	nsfw_level?: number | undefined;
	explicit_content_filter?: number | undefined;
	default_message_notifications?: number | undefined;
	disabled_operations?: number | undefined;
}

export async function lookupGuild(
	config: Config,
	session: Session,
	guildId: string,
): Promise<ApiResult<GuildLookupResult | null>> {
	const client = new ApiClient(config, session);
	const result = await client.post<z.infer<typeof LookupGuildResponse>>('/admin/guilds/lookup', {guild_id: guildId});
	if (result.ok) {
		return {ok: true, data: result.data.guild};
	}
	return result;
}

export async function clearGuildFields(
	config: Config,
	session: Session,
	guildId: string,
	fields: Array<string>,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/clear-fields', {guild_id: guildId, fields});
}

export async function updateGuildFeatures(
	config: Config,
	session: Session,
	guildId: string,
	addFeatures: Array<string>,
	removeFeatures: Array<string>,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/update-features', {
		guild_id: guildId,
		add_features: addFeatures,
		remove_features: removeFeatures,
	});
}

export async function updateGuildSettings(
	config: Config,
	session: Session,
	guildId: string,
	options: UpdateGuildSettingsOptions,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		guild_id: guildId,
		...(options.verification_level !== undefined ? {verification_level: options.verification_level} : {}),
		...(options.mfa_level !== undefined ? {mfa_level: options.mfa_level} : {}),
		...(options.nsfw_level !== undefined ? {nsfw_level: options.nsfw_level} : {}),
		...(options.explicit_content_filter !== undefined
			? {explicit_content_filter: options.explicit_content_filter}
			: {}),
		...(options.default_message_notifications !== undefined
			? {default_message_notifications: options.default_message_notifications}
			: {}),
		...(options.disabled_operations !== undefined ? {disabled_operations: options.disabled_operations} : {}),
	};

	return client.postVoid('/admin/guilds/update-settings', body);
}

export async function updateGuildName(
	config: Config,
	session: Session,
	guildId: string,
	name: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/update-name', {guild_id: guildId, name});
}

export async function updateGuildVanity(
	config: Config,
	session: Session,
	guildId: string,
	vanityUrlCode?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		guild_id: guildId,
		...(vanityUrlCode !== undefined ? {vanity_url_code: vanityUrlCode} : {}),
	};
	return client.postVoid('/admin/guilds/update-vanity', body);
}

export async function transferGuildOwnership(
	config: Config,
	session: Session,
	guildId: string,
	newOwnerId: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/transfer-ownership', {guild_id: guildId, new_owner_id: newOwnerId});
}

export async function reloadGuild(config: Config, session: Session, guildId: string): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/reload', {guild_id: guildId});
}

export async function shutdownGuild(config: Config, session: Session, guildId: string): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/shutdown', {guild_id: guildId});
}

export async function deleteGuild(config: Config, session: Session, guildId: string): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/delete', {guild_id: guildId});
}

export async function forceAddUserToGuild(
	config: Config,
	session: Session,
	userId: string,
	guildId: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/force-add-user', {user_id: userId, guild_id: guildId});
}

export async function searchGuilds(
	config: Config,
	session: Session,
	query: string,
	limit: number = 25,
	offset: number = 0,
): Promise<ApiResult<z.infer<typeof SearchGuildsResponse>>> {
	const client = new ApiClient(config, session);
	return client.post<z.infer<typeof SearchGuildsResponse>>('/admin/guilds/search', {query, limit, offset});
}

export async function listGuildMembers(
	config: Config,
	session: Session,
	guildId: string,
	limit: number = 50,
	offset: number = 0,
): Promise<ApiResult<z.infer<typeof ListGuildMembersResponse>>> {
	const client = new ApiClient(config, session);
	return client.post<z.infer<typeof ListGuildMembersResponse>>('/admin/guilds/list-members', {
		guild_id: guildId,
		limit,
		offset,
	});
}

export async function banGuildMember(
	config: Config,
	session: Session,
	guildId: string,
	userId: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/ban-member', {guild_id: guildId, user_id: userId});
}

export async function kickGuildMember(
	config: Config,
	session: Session,
	guildId: string,
	userId: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/guilds/kick-member', {guild_id: guildId, user_id: userId});
}
