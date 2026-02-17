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

import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {
	CreateVoiceRegionRequest,
	CreateVoiceRegionResponse,
	CreateVoiceServerRequest,
	CreateVoiceServerResponse,
	DeleteVoiceRegionRequest,
	DeleteVoiceResponse,
	DeleteVoiceServerRequest,
	GetVoiceRegionRequest,
	GetVoiceRegionResponse,
	GetVoiceServerRequest,
	GetVoiceServerResponse,
	ListVoiceRegionsRequest,
	ListVoiceRegionsResponse,
	ListVoiceServersRequest,
	ListVoiceServersResponse,
	UpdateVoiceRegionRequest,
	UpdateVoiceRegionResponse,
	UpdateVoiceServerRequest,
	UpdateVoiceServerResponse,
} from '@fluxer/schema/src/domains/admin/AdminVoiceSchemas';

export function VoiceAdminController(app: HonoApp) {
	app.post(
		'/admin/voice/regions/list',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.VOICE_REGION_LIST),
		Validator('json', ListVoiceRegionsRequest),
		OpenAPI({
			operationId: 'list_voice_regions',
			summary: 'List voice regions',
			responseSchema: ListVoiceRegionsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Lists all configured voice server regions with status and server count. Shows region names, latency info, and availability. Requires VOICE_REGION_LIST permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.listVoiceRegions(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/regions/get',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.VOICE_REGION_LIST),
		Validator('json', GetVoiceRegionRequest),
		OpenAPI({
			operationId: 'get_voice_region',
			summary: 'Get voice region',
			responseSchema: GetVoiceRegionResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Gets detailed information about a voice region including assigned servers and capacity. Shows performance metrics and server details. Requires VOICE_REGION_LIST permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.getVoiceRegion(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/regions/create',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.VOICE_REGION_CREATE),
		Validator('json', CreateVoiceRegionRequest),
		OpenAPI({
			operationId: 'create_voice_region',
			summary: 'Create voice region',
			responseSchema: CreateVoiceRegionResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Creates a new voice server region. Defines geographic location and performance characteristics for voice routing. Creates audit log entry. Requires VOICE_REGION_CREATE permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.createVoiceRegion(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/regions/update',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.VOICE_REGION_UPDATE),
		Validator('json', UpdateVoiceRegionRequest),
		OpenAPI({
			operationId: 'update_voice_region',
			summary: 'Update voice region',
			responseSchema: UpdateVoiceRegionResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Updates voice region settings such as latency thresholds or priority. Changes affect voice routing for new sessions. Creates audit log entry. Requires VOICE_REGION_UPDATE permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.updateVoiceRegion(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/regions/delete',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.VOICE_REGION_DELETE),
		Validator('json', DeleteVoiceRegionRequest),
		OpenAPI({
			operationId: 'delete_voice_region',
			summary: 'Delete voice region',
			responseSchema: DeleteVoiceResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Deletes a voice region. Removes region from routing and reassigns active connections. Creates audit log entry. Requires VOICE_REGION_DELETE permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.deleteVoiceRegion(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/servers/list',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.VOICE_SERVER_LIST),
		Validator('json', ListVoiceServersRequest),
		OpenAPI({
			operationId: 'list_voice_servers',
			summary: 'List voice servers',
			responseSchema: ListVoiceServersResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Lists all voice servers with connection counts and capacity. Shows server status, region assignment, and load metrics. Supports filtering and pagination. Requires VOICE_SERVER_LIST permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.listVoiceServers(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/servers/get',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.VOICE_SERVER_LIST),
		Validator('json', GetVoiceServerRequest),
		OpenAPI({
			operationId: 'get_voice_server',
			summary: 'Get voice server',
			responseSchema: GetVoiceServerResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Gets detailed voice server information including active connections, configuration, and performance metrics. Requires VOICE_SERVER_LIST permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.getVoiceServer(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/servers/create',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.VOICE_SERVER_CREATE),
		Validator('json', CreateVoiceServerRequest),
		OpenAPI({
			operationId: 'create_voice_server',
			summary: 'Create voice server',
			responseSchema: CreateVoiceServerResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Creates and provisions a new voice server instance in a region. Configures capacity, codecs, and encryption. Creates audit log entry. Requires VOICE_SERVER_CREATE permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.createVoiceServer(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/servers/update',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.VOICE_SERVER_UPDATE),
		Validator('json', UpdateVoiceServerRequest),
		OpenAPI({
			operationId: 'update_voice_server',
			summary: 'Update voice server',
			responseSchema: UpdateVoiceServerResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Updates voice server configuration including capacity, region assignment, and quality settings. Changes apply to new connections. Creates audit log entry. Requires VOICE_SERVER_UPDATE permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.updateVoiceServer(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/voice/servers/delete',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.VOICE_SERVER_DELETE),
		Validator('json', DeleteVoiceServerRequest),
		OpenAPI({
			operationId: 'delete_voice_server',
			summary: 'Delete voice server',
			responseSchema: DeleteVoiceResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Decommissions and removes a voice server instance. Disconnects active sessions and migrates to other servers. Creates audit log entry. Requires VOICE_SERVER_DELETE permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.deleteVoiceServer(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);
}
