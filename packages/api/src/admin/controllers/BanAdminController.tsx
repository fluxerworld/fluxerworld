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
	BanCheckResponseSchema,
	BanEmailRequest,
	BanIpRequest,
	BanPhoneRequest,
	ListBansRequest,
	ListEmailBansResponseSchema,
	ListIpBansResponseSchema,
	ListPhoneBansResponseSchema,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export function BanAdminController(app: HonoApp) {
	app.post(
		'/admin/bans/ip/add',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_IP_ADD),
		Validator('json', BanIpRequest),
		OpenAPI({
			operationId: 'add_ip_ban',
			summary: 'Add IP ban',
			responseSchema: null,
			statusCode: 204,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Ban one or more IP addresses from accessing the platform. Users connecting from banned IPs will be denied service. Can be applied retroactively.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const result = await adminService.banIp(ctx.req.valid('json'), adminUserId, auditLogReason);

			return ctx.json(result);
		},
	);

	app.post(
		'/admin/bans/ip/remove',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_IP_REMOVE),
		Validator('json', BanIpRequest),
		OpenAPI({
			operationId: 'remove_ip_ban',
			summary: 'Remove IP ban',
			responseSchema: null,
			statusCode: 204,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Lift a previously applied IP ban, allowing traffic from those addresses again. Used for appeals or when bans were applied in error.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const result = await adminService.unbanIp(ctx.req.valid('json'), adminUserId, auditLogReason);

			return ctx.json(result);
		},
	);

	app.post(
		'/admin/bans/ip/check',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_IP_CHECK),
		Validator('json', BanIpRequest),
		OpenAPI({
			operationId: 'check_ip_ban_status',
			summary: 'Check IP ban status',
			responseSchema: BanCheckResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Query whether one or more IP addresses are currently banned. Returns the ban status and any associated metadata like reason or expiration.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.checkIpBan(ctx.req.valid('json')));
		},
	);

	app.post(
		'/admin/bans/ip/list',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_IP_CHECK),
		Validator('json', ListBansRequest),
		OpenAPI({
			operationId: 'list_ip_bans',
			summary: 'List IP bans',
			responseSchema: ListIpBansResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description: 'List currently banned IPs/CIDR ranges. Includes reverse DNS where available.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.listIpBans(body));
		},
	);

	app.post(
		'/admin/bans/email/add',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_EMAIL_ADD),
		Validator('json', BanEmailRequest),
		OpenAPI({
			operationId: 'add_email_ban',
			summary: 'Add email ban',
			responseSchema: null,
			statusCode: 204,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Ban one or more email addresses from registering or creating accounts. Users attempting to use banned emails will be blocked.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const result = await adminService.banEmail(ctx.req.valid('json'), adminUserId, auditLogReason);

			return ctx.json(result);
		},
	);

	app.post(
		'/admin/bans/email/remove',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_EMAIL_REMOVE),
		Validator('json', BanEmailRequest),
		OpenAPI({
			operationId: 'remove_email_ban',
			summary: 'Remove email ban',
			responseSchema: null,
			statusCode: 204,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Lift a previously applied email ban, allowing the address to be used for new registrations. Used for appeals or error correction.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const result = await adminService.unbanEmail(ctx.req.valid('json'), adminUserId, auditLogReason);

			return ctx.json(result);
		},
	);

	app.post(
		'/admin/bans/email/check',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_EMAIL_CHECK),
		Validator('json', BanEmailRequest),
		OpenAPI({
			operationId: 'check_email_ban_status',
			summary: 'Check email ban status',
			responseSchema: BanCheckResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Query whether one or more email addresses are currently banned from registration. Returns the ban status and metadata.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.checkEmailBan(ctx.req.valid('json')));
		},
	);

	app.post(
		'/admin/bans/email/list',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_EMAIL_CHECK),
		Validator('json', ListBansRequest),
		OpenAPI({
			operationId: 'list_email_bans',
			summary: 'List email bans',
			responseSchema: ListEmailBansResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description: 'List currently banned email addresses.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.listEmailBans(body));
		},
	);

	app.post(
		'/admin/bans/phone/add',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_PHONE_ADD),
		Validator('json', BanPhoneRequest),
		OpenAPI({
			operationId: 'add_phone_ban',
			summary: 'Add phone ban',
			responseSchema: null,
			statusCode: 204,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Ban one or more phone numbers from account verification or SMS operations. Users attempting to use banned numbers will be blocked.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const result = await adminService.banPhone(ctx.req.valid('json'), adminUserId, auditLogReason);

			return ctx.json(result);
		},
	);

	app.post(
		'/admin/bans/phone/remove',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_PHONE_REMOVE),
		Validator('json', BanPhoneRequest),
		OpenAPI({
			operationId: 'remove_phone_ban',
			summary: 'Remove phone ban',
			responseSchema: null,
			statusCode: 204,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Lift a previously applied phone ban, allowing the number to be used for verification again. Used for appeals or error correction.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const result = await adminService.unbanPhone(ctx.req.valid('json'), adminUserId, auditLogReason);

			return ctx.json(result);
		},
	);

	app.post(
		'/admin/bans/phone/check',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_PHONE_CHECK),
		Validator('json', BanPhoneRequest),
		OpenAPI({
			operationId: 'check_phone_ban_status',
			summary: 'Check phone ban status',
			responseSchema: BanCheckResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Query whether one or more phone numbers are currently banned. Returns the ban status and metadata for verification or appeal purposes.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.checkPhoneBan(ctx.req.valid('json')));
		},
	);

	app.post(
		'/admin/bans/phone/list',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BAN_OPERATION),
		requireAdminACL(AdminACLs.BAN_PHONE_CHECK),
		Validator('json', ListBansRequest),
		OpenAPI({
			operationId: 'list_phone_bans',
			summary: 'List phone bans',
			responseSchema: ListPhoneBansResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description: 'List currently banned phone numbers.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.listPhoneBans(body));
		},
	);
}
