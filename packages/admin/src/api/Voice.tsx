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
	CreateVoiceRegionRequest,
	CreateVoiceServerRequest,
	ListVoiceRegionsResponse,
	ListVoiceServersResponse,
	UpdateVoiceRegionRequest,
	UpdateVoiceServerRequest,
	VoiceRegionWithServersResponse,
	VoiceServerAdminResponse,
} from '@fluxer/schema/src/domains/admin/AdminVoiceSchemas';
import type {z} from 'zod';

export interface GetVoiceRegionResponse {
	region: VoiceRegionWithServersResponse | null;
}

export interface GetVoiceServerResponse {
	server: VoiceServerAdminResponse | null;
}

export async function listVoiceRegions(
	config: Config,
	session: Session,
	include_servers: boolean,
): Promise<ApiResult<ListVoiceRegionsResponse>> {
	const client = new ApiClient(config, session);
	return client.post<ListVoiceRegionsResponse>('/admin/voice/regions/list', {include_servers});
}

export async function getVoiceRegion(
	config: Config,
	session: Session,
	id: string,
	include_servers: boolean,
): Promise<ApiResult<GetVoiceRegionResponse>> {
	const client = new ApiClient(config, session);
	return client.post<GetVoiceRegionResponse>('/admin/voice/regions/get', {
		id,
		include_servers,
	});
}

export interface CreateVoiceRegionParams
	extends Omit<z.infer<typeof CreateVoiceRegionRequest>, 'allowed_guild_ids' | 'allowed_user_ids'> {
	allowed_guild_ids: Array<string>;
	allowed_user_ids?: Array<string>;
	audit_log_reason?: string;
}

export async function createVoiceRegion(
	config: Config,
	session: Session,
	params: CreateVoiceRegionParams,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid(
		'/admin/voice/regions/create',
		{
			id: params.id,
			name: params.name,
			emoji: params.emoji,
			latitude: params.latitude,
			longitude: params.longitude,
			is_default: params.is_default,
			vip_only: params.vip_only,
			required_guild_features: params.required_guild_features,
			allowed_guild_ids: params.allowed_guild_ids,
			allowed_user_ids: params.allowed_user_ids ?? [],
		},
		params.audit_log_reason,
	);
}

export interface UpdateVoiceRegionParams
	extends Omit<z.infer<typeof UpdateVoiceRegionRequest>, 'allowed_guild_ids' | 'allowed_user_ids'> {
	allowed_guild_ids?: Array<string>;
	allowed_user_ids?: Array<string>;
	audit_log_reason?: string;
}

export async function updateVoiceRegion(
	config: Config,
	session: Session,
	params: UpdateVoiceRegionParams,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		id: params.id,
		...(params.name !== undefined ? {name: params.name} : {}),
		...(params.emoji !== undefined ? {emoji: params.emoji} : {}),
		...(params.latitude !== undefined ? {latitude: params.latitude} : {}),
		...(params.longitude !== undefined ? {longitude: params.longitude} : {}),
		...(params.is_default !== undefined ? {is_default: params.is_default} : {}),
		...(params.vip_only !== undefined ? {vip_only: params.vip_only} : {}),
		...(params.required_guild_features !== undefined ? {required_guild_features: params.required_guild_features} : {}),
		...(params.allowed_guild_ids !== undefined ? {allowed_guild_ids: params.allowed_guild_ids} : {}),
		...(params.allowed_user_ids !== undefined ? {allowed_user_ids: params.allowed_user_ids} : {}),
	};

	return client.postVoid('/admin/voice/regions/update', body, params.audit_log_reason);
}

export async function deleteVoiceRegion(
	config: Config,
	session: Session,
	id: string,
	audit_log_reason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/voice/regions/delete', {id}, audit_log_reason);
}

export async function listVoiceServers(
	config: Config,
	session: Session,
	region_id: string,
): Promise<ApiResult<ListVoiceServersResponse>> {
	const client = new ApiClient(config, session);
	return client.post<ListVoiceServersResponse>('/admin/voice/servers/list', {region_id});
}

export interface CreateVoiceServerParams
	extends Omit<z.infer<typeof CreateVoiceServerRequest>, 'allowed_guild_ids' | 'allowed_user_ids'> {
	allowed_guild_ids: Array<string>;
	allowed_user_ids?: Array<string>;
	audit_log_reason?: string;
}

export async function createVoiceServer(
	config: Config,
	session: Session,
	params: CreateVoiceServerParams,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid(
		'/admin/voice/servers/create',
		{
			region_id: params.region_id,
			server_id: params.server_id,
			endpoint: params.endpoint,
			api_key: params.api_key,
			api_secret: params.api_secret,
			is_active: params.is_active,
			vip_only: params.vip_only,
			required_guild_features: params.required_guild_features,
			allowed_guild_ids: params.allowed_guild_ids,
			allowed_user_ids: params.allowed_user_ids ?? [],
		},
		params.audit_log_reason,
	);
}

export interface UpdateVoiceServerParams
	extends Omit<z.infer<typeof UpdateVoiceServerRequest>, 'allowed_guild_ids' | 'allowed_user_ids'> {
	allowed_guild_ids?: Array<string>;
	allowed_user_ids?: Array<string>;
	audit_log_reason?: string;
}

export async function updateVoiceServer(
	config: Config,
	session: Session,
	params: UpdateVoiceServerParams,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		region_id: params.region_id,
		server_id: params.server_id,
		...(params.endpoint !== undefined ? {endpoint: params.endpoint} : {}),
		...(params.api_key !== undefined ? {api_key: params.api_key} : {}),
		...(params.api_secret !== undefined ? {api_secret: params.api_secret} : {}),
		...(params.is_active !== undefined ? {is_active: params.is_active} : {}),
		...(params.vip_only !== undefined ? {vip_only: params.vip_only} : {}),
		...(params.required_guild_features !== undefined ? {required_guild_features: params.required_guild_features} : {}),
		...(params.allowed_guild_ids !== undefined ? {allowed_guild_ids: params.allowed_guild_ids} : {}),
		...(params.allowed_user_ids !== undefined ? {allowed_user_ids: params.allowed_user_ids} : {}),
	};

	return client.postVoid('/admin/voice/servers/update', body, params.audit_log_reason);
}

export async function deleteVoiceServer(
	config: Config,
	session: Session,
	region_id: string,
	server_id: string,
	audit_log_reason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/voice/servers/delete', {region_id, server_id}, audit_log_reason);
}
