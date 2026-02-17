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

import {Config} from '@fluxer/api/src/Config';
import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {FeatureNotAvailableSelfHostedError} from '@fluxer/errors/src/domains/core/FeatureNotAvailableSelfHostedError';
import {
	AddSnowflakeReservationRequest,
	DeleteSnowflakeReservationRequest,
	ListSnowflakeReservationsResponse,
	SuccessResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export function SnowflakeReservationAdminController(app: HonoApp) {
	app.post(
		'/admin/snowflake-reservations/list',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.INSTANCE_SNOWFLAKE_RESERVATION_VIEW),
		OpenAPI({
			operationId: 'list_snowflake_reservations',
			summary: 'List snowflake reservations',
			responseSchema: ListSnowflakeReservationsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Lists all reserved snowflake ID ranges. Shows ranges reserved for future entities and their allocation status. Requires INSTANCE_SNOWFLAKE_RESERVATION_VIEW permission.',
		}),
		async (ctx) => {
			if (Config.instance.selfHosted) {
				throw new FeatureNotAvailableSelfHostedError();
			}

			const adminService = ctx.get('adminService');
			const reservations = await adminService.listSnowflakeReservations();

			return ctx.json({
				reservations,
			});
		},
	);

	app.post(
		'/admin/snowflake-reservations/add',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.INSTANCE_SNOWFLAKE_RESERVATION_MANAGE),
		Validator('json', AddSnowflakeReservationRequest),
		OpenAPI({
			operationId: 'add_snowflake_reservation',
			summary: 'Add snowflake reservation',
			responseSchema: SuccessResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Reserves a snowflake ID range for future allocation. Creates audit log entry. Requires INSTANCE_SNOWFLAKE_RESERVATION_MANAGE permission.',
		}),
		async (ctx) => {
			if (Config.instance.selfHosted) {
				throw new FeatureNotAvailableSelfHostedError();
			}

			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const data = ctx.req.valid('json');

			await adminService.setSnowflakeReservation(data, adminUserId, auditLogReason);
			return ctx.json({success: true});
		},
	);

	app.post(
		'/admin/snowflake-reservations/delete',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.INSTANCE_SNOWFLAKE_RESERVATION_MANAGE),
		Validator('json', DeleteSnowflakeReservationRequest),
		OpenAPI({
			operationId: 'delete_snowflake_reservation',
			summary: 'Delete snowflake reservation',
			responseSchema: SuccessResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
			description:
				'Removes a snowflake ID reservation range. Creates audit log entry. Requires INSTANCE_SNOWFLAKE_RESERVATION_MANAGE permission.',
		}),
		async (ctx) => {
			if (Config.instance.selfHosted) {
				throw new FeatureNotAvailableSelfHostedError();
			}

			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const data = ctx.req.valid('json');

			await adminService.deleteSnowflakeReservation(data, adminUserId, auditLogReason);
			return ctx.json({success: true});
		},
	);
}
