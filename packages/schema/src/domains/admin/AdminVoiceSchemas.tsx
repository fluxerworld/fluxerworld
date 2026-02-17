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

import {createStringType, SnowflakeStringType, SnowflakeType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const VoiceRegionAdminResponse = z.object({
	id: z.string().describe('Unique identifier for the voice region'),
	name: z.string().describe('Display name of the voice region'),
	emoji: z.string().describe('Emoji representing the region'),
	latitude: z.number().describe('Geographic latitude coordinate'),
	longitude: z.number().describe('Geographic longitude coordinate'),
	is_default: z.boolean().describe('Whether this is the default region'),
	vip_only: z.boolean().describe('Whether this region is restricted to VIP users'),
	required_guild_features: z.array(z.string()).max(100).describe('Guild features required to use this region'),
	allowed_guild_ids: z.array(SnowflakeStringType).max(1000).describe('Guild IDs explicitly allowed to use this region'),
	allowed_user_ids: z.array(SnowflakeStringType).max(1000).describe('User IDs explicitly allowed to use this region'),
	created_at: z.string().nullable().describe('ISO 8601 timestamp when the region was created'),
	updated_at: z.string().nullable().describe('ISO 8601 timestamp when the region was last updated'),
});

export type VoiceRegionAdminResponse = z.infer<typeof VoiceRegionAdminResponse>;

export const VoiceServerAdminResponse = z.object({
	region_id: z.string().describe('ID of the region this server belongs to'),
	server_id: z.string().describe('Unique identifier for the voice server'),
	endpoint: z.url().describe('Client signal WebSocket endpoint URL for the voice server'),
	is_active: z.boolean().describe('Whether the server is currently active'),
	vip_only: z.boolean().describe('Whether this server is restricted to VIP users'),
	required_guild_features: z.array(z.string()).max(100).describe('Guild features required to use this server'),
	allowed_guild_ids: z.array(SnowflakeStringType).max(1000).describe('Guild IDs explicitly allowed to use this server'),
	allowed_user_ids: z.array(SnowflakeStringType).max(1000).describe('User IDs explicitly allowed to use this server'),
	created_at: z.string().nullable().describe('ISO 8601 timestamp when the server was created'),
	updated_at: z.string().nullable().describe('ISO 8601 timestamp when the server was last updated'),
});

export type VoiceServerAdminResponse = z.infer<typeof VoiceServerAdminResponse>;

export const CreateVoiceRegionRequest = z.object({
	id: createStringType(1, 64).describe('Unique identifier for the voice region'),
	name: createStringType(1, 100).describe('Display name of the voice region'),
	emoji: createStringType(1, 64).describe('Emoji representing the region'),
	latitude: z.number().describe('Geographic latitude coordinate'),
	longitude: z.number().describe('Geographic longitude coordinate'),
	is_default: z.boolean().optional().default(false).describe('Whether this is the default region'),
	vip_only: z.boolean().optional().default(false).describe('Whether this region is restricted to VIP users'),
	required_guild_features: z
		.array(createStringType(1, 64))
		.max(100)
		.optional()
		.default([])
		.describe('Guild features required to use this region'),
	allowed_guild_ids: z
		.array(SnowflakeType)
		.max(1000)
		.optional()
		.default([])
		.describe('Guild IDs explicitly allowed to use this region'),
	allowed_user_ids: z
		.array(SnowflakeType)
		.max(1000)
		.optional()
		.default([])
		.describe('User IDs explicitly allowed to use this region'),
});

export type CreateVoiceRegionRequest = z.infer<typeof CreateVoiceRegionRequest>;

export const UpdateVoiceRegionRequest = z.object({
	id: createStringType(1, 64).describe('Unique identifier for the voice region'),
	name: createStringType(1, 100).optional().describe('Display name of the voice region'),
	emoji: createStringType(1, 64).optional().describe('Emoji representing the region'),
	latitude: z.number().optional().describe('Geographic latitude coordinate'),
	longitude: z.number().optional().describe('Geographic longitude coordinate'),
	is_default: z.boolean().optional().describe('Whether this is the default region'),
	vip_only: z.boolean().optional().describe('Whether this region is restricted to VIP users'),
	required_guild_features: z
		.array(createStringType(1, 64))
		.max(100)
		.optional()
		.describe('Guild features required to use this region'),
	allowed_guild_ids: z
		.array(SnowflakeType)
		.max(1000)
		.optional()
		.describe('Guild IDs explicitly allowed to use this region'),
	allowed_user_ids: z
		.array(SnowflakeType)
		.max(1000)
		.optional()
		.describe('User IDs explicitly allowed to use this region'),
});

export type UpdateVoiceRegionRequest = z.infer<typeof UpdateVoiceRegionRequest>;

export const DeleteVoiceRegionRequest = z.object({
	id: createStringType(1, 64).describe('ID of the voice region to delete'),
});

export type DeleteVoiceRegionRequest = z.infer<typeof DeleteVoiceRegionRequest>;

export const CreateVoiceServerRequest = z.object({
	region_id: createStringType(1, 64).describe('ID of the region this server belongs to'),
	server_id: createStringType(1, 64).describe('Unique identifier for the voice server'),
	endpoint: z.url().describe('Client signal WebSocket endpoint URL for the voice server'),
	api_key: createStringType(1, 256).describe('API key for authenticating with the voice server'),
	api_secret: createStringType(1, 256).describe('API secret for authenticating with the voice server'),
	is_active: z.boolean().optional().default(true).describe('Whether the server is currently active'),
	vip_only: z.boolean().optional().default(false).describe('Whether this server is restricted to VIP users'),
	required_guild_features: z
		.array(createStringType(1, 64))
		.max(100)
		.optional()
		.default([])
		.describe('Guild features required to use this server'),
	allowed_guild_ids: z
		.array(SnowflakeType)
		.max(1000)
		.optional()
		.default([])
		.describe('Guild IDs explicitly allowed to use this server'),
	allowed_user_ids: z
		.array(SnowflakeType)
		.max(1000)
		.optional()
		.default([])
		.describe('User IDs explicitly allowed to use this server'),
});

export type CreateVoiceServerRequest = z.infer<typeof CreateVoiceServerRequest>;

export const UpdateVoiceServerRequest = z.object({
	region_id: createStringType(1, 64).describe('ID of the region this server belongs to'),
	server_id: createStringType(1, 64).describe('Unique identifier for the voice server'),
	endpoint: z.url().optional().describe('Client signal WebSocket endpoint URL for the voice server'),
	api_key: createStringType(1, 256).optional().describe('API key for authenticating with the voice server'),
	api_secret: createStringType(1, 256).optional().describe('API secret for authenticating with the voice server'),
	is_active: z.boolean().optional().describe('Whether the server is currently active'),
	vip_only: z.boolean().optional().describe('Whether this server is restricted to VIP users'),
	required_guild_features: z
		.array(createStringType(1, 64))
		.max(100)
		.optional()
		.describe('Guild features required to use this server'),
	allowed_guild_ids: z
		.array(SnowflakeType)
		.max(1000)
		.optional()
		.describe('Guild IDs explicitly allowed to use this server'),
	allowed_user_ids: z
		.array(SnowflakeType)
		.max(1000)
		.optional()
		.describe('User IDs explicitly allowed to use this server'),
});

export type UpdateVoiceServerRequest = z.infer<typeof UpdateVoiceServerRequest>;

export const DeleteVoiceServerRequest = z.object({
	region_id: createStringType(1, 64).describe('ID of the region the server belongs to'),
	server_id: createStringType(1, 64).describe('ID of the voice server to delete'),
});

export type DeleteVoiceServerRequest = z.infer<typeof DeleteVoiceServerRequest>;

export const ListVoiceRegionsRequest = z.object({
	include_servers: z.boolean().optional().default(false).describe('Whether to include voice servers in the response'),
});

export type ListVoiceRegionsRequest = z.infer<typeof ListVoiceRegionsRequest>;

export const GetVoiceRegionRequest = z.object({
	id: createStringType(1, 64).describe('ID of the voice region to retrieve'),
	include_servers: z.boolean().optional().default(true).describe('Whether to include voice servers in the response'),
});

export type GetVoiceRegionRequest = z.infer<typeof GetVoiceRegionRequest>;

export const ListVoiceServersRequest = z.object({
	region_id: createStringType(1, 64).describe('ID of the region to list servers for'),
});

export type ListVoiceServersRequest = z.infer<typeof ListVoiceServersRequest>;

export const GetVoiceServerRequest = z.object({
	region_id: createStringType(1, 64).describe('ID of the region the server belongs to'),
	server_id: createStringType(1, 64).describe('ID of the voice server to retrieve'),
});

export type GetVoiceServerRequest = z.infer<typeof GetVoiceServerRequest>;

export const ListVoiceRegionsResponse = z.object({
	regions: z.array(VoiceRegionAdminResponse).max(100).describe('List of voice regions'),
});

export type ListVoiceRegionsResponse = z.infer<typeof ListVoiceRegionsResponse>;

export const VoiceRegionWithServersResponse = VoiceRegionAdminResponse.extend({
	servers: z.array(VoiceServerAdminResponse).max(100).optional().describe('Voice servers in this region'),
});

export type VoiceRegionWithServersResponse = z.infer<typeof VoiceRegionWithServersResponse>;

export const GetVoiceRegionResponse = z.object({
	region: VoiceRegionWithServersResponse.nullable().describe('Voice region details or null if not found'),
});

export type GetVoiceRegionResponse = z.infer<typeof GetVoiceRegionResponse>;

export const CreateVoiceRegionResponse = z.object({
	region: VoiceRegionAdminResponse.describe('Created voice region'),
});

export type CreateVoiceRegionResponse = z.infer<typeof CreateVoiceRegionResponse>;

export const UpdateVoiceRegionResponse = z.object({
	region: VoiceRegionAdminResponse.describe('Updated voice region'),
});

export type UpdateVoiceRegionResponse = z.infer<typeof UpdateVoiceRegionResponse>;

export const ListVoiceServersResponse = z.object({
	servers: z.array(VoiceServerAdminResponse).max(100).describe('List of voice servers'),
});

export type ListVoiceServersResponse = z.infer<typeof ListVoiceServersResponse>;

export const GetVoiceServerResponse = z.object({
	server: VoiceServerAdminResponse.nullable().describe('Voice server details or null if not found'),
});

export type GetVoiceServerResponse = z.infer<typeof GetVoiceServerResponse>;

export const CreateVoiceServerResponse = z.object({
	server: VoiceServerAdminResponse.describe('Created voice server'),
});

export type CreateVoiceServerResponse = z.infer<typeof CreateVoiceServerResponse>;

export const UpdateVoiceServerResponse = z.object({
	server: VoiceServerAdminResponse.describe('Updated voice server'),
});

export type UpdateVoiceServerResponse = z.infer<typeof UpdateVoiceServerResponse>;

export const DeleteVoiceResponse = z.object({
	success: z.boolean().describe('Whether the deletion was successful'),
});

export type DeleteVoiceResponse = z.infer<typeof DeleteVoiceResponse>;
