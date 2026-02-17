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

import type {AdminService} from '@fluxer/api/src/admin/AdminService';
import {createGuildID, type GuildID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {
	CreateSystemDmJobRequest,
	ListSystemDmJobsResponse,
	SystemDmJobResponse,
	SystemDmJobsQueryRequest,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {JobIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';

function parseGuildIds(ids: Array<bigint> | undefined): Array<GuildID> {
	if (!ids) {
		return [];
	}
	return ids.map((id) => createGuildID(id));
}

export function SystemDmAdminController(app: HonoApp) {
	app.post(
		'/admin/system-dm-jobs',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.SYSTEM_DM_SEND),
		Validator('json', CreateSystemDmJobRequest),
		OpenAPI({
			operationId: 'create_system_dm_job',
			summary: 'Create system DM job',
			responseSchema: SystemDmJobResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Creates a system DM broadcast job to send messages to users matching registration date criteria. Supports date range filtering and guild exclusions. Requires SYSTEM_DM_SEND permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService') as AdminService;
			const adminUserId = ctx.get('adminUserId') as UserID;
			const auditLogReason = ctx.get('auditLogReason');
			const payload = ctx.req.valid('json');

			const job = await adminService.createSystemDmJob(
				{
					content: payload.content,
					registrationStart: payload.registration_start ? new Date(payload.registration_start) : undefined,
					registrationEnd: payload.registration_end ? new Date(payload.registration_end) : undefined,
					excludedGuildIds: parseGuildIds(payload.excluded_guild_ids ?? []),
				},
				adminUserId,
				auditLogReason,
			);
			return ctx.json(job);
		},
	);

	app.get(
		'/admin/system-dm-jobs',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.SYSTEM_DM_SEND),
		Validator('query', SystemDmJobsQueryRequest),
		OpenAPI({
			operationId: 'list_system_dm_jobs',
			summary: 'List system DM jobs',
			responseSchema: ListSystemDmJobsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Lists system DM broadcast jobs with pagination. Shows job status, creation time, and content preview. Requires SYSTEM_DM_SEND permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService') as AdminService;
			const {limit, before_job_id} = ctx.req.valid('query');

			const result = await adminService.listSystemDmJobs(limit, before_job_id ?? undefined);
			return ctx.json(result);
		},
	);

	app.post(
		'/admin/system-dm-jobs/:job_id/approve',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_MESSAGE_OPERATION),
		requireAdminACL(AdminACLs.SYSTEM_DM_SEND),
		Validator('param', JobIdParam),
		OpenAPI({
			operationId: 'approve_system_dm_job',
			summary: 'Approve system DM job',
			responseSchema: SystemDmJobResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Approves and queues a system DM job for immediate execution. Creates audit log entry. Job will begin sending messages to target users. Requires SYSTEM_DM_SEND permission.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService') as AdminService;
			const adminUserId = ctx.get('adminUserId') as UserID;
			const auditLogReason = ctx.get('auditLogReason');
			const {job_id: jobId} = ctx.req.valid('param');

			const job = await adminService.approveSystemDmJob(jobId, adminUserId, auditLogReason);
			return ctx.json(job);
		},
	);
}
