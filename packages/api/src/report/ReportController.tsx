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

import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {
	DsaReportEmailSendRequest,
	DsaReportEmailVerifyRequest,
	DsaReportRequest,
	OkResponse,
	ReportGuildRequest,
	ReportMessageRequest,
	ReportResponse,
	ReportUserRequest,
	TicketResponse,
} from '@fluxer/schema/src/domains/report/ReportSchemas';

export function ReportController(app: HonoApp) {
	app.post(
		'/reports/message',
		RateLimitMiddleware(RateLimitConfigs.REPORT_CREATE),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'report_message',
			summary: 'Report message',
			description: 'Submits a report about a message to moderators for content violation review.',
			responseSchema: ReportResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Reports',
		}),
		Validator('json', ReportMessageRequest),
		async (ctx) => {
			return ctx.json(
				await ctx.get('reportRequestService').reportMessage({
					user: ctx.get('user'),
					data: ctx.req.valid('json'),
				}),
			);
		},
	);

	app.post(
		'/reports/user',
		RateLimitMiddleware(RateLimitConfigs.REPORT_CREATE),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'report_user',
			summary: 'Report user',
			description: 'Submits a report about a user to moderators for content violation or behaviour review.',
			responseSchema: ReportResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Reports',
		}),
		Validator('json', ReportUserRequest),
		async (ctx) => {
			return ctx.json(
				await ctx.get('reportRequestService').reportUser({
					user: ctx.get('user'),
					data: ctx.req.valid('json'),
				}),
			);
		},
	);

	app.post(
		'/reports/guild',
		RateLimitMiddleware(RateLimitConfigs.REPORT_CREATE),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'report_guild',
			summary: 'Report guild',
			description: 'Submits a report about a guild to moderators for policy violation review.',
			responseSchema: ReportResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Reports',
		}),
		Validator('json', ReportGuildRequest),
		async (ctx) => {
			return ctx.json(
				await ctx.get('reportRequestService').reportGuild({
					user: ctx.get('user'),
					data: ctx.req.valid('json'),
				}),
			);
		},
	);

	app.post(
		'/reports/dsa/email/send',
		RateLimitMiddleware(RateLimitConfigs.DSA_REPORT_EMAIL_SEND),
		OpenAPI({
			operationId: 'send_dsa_report_email',
			summary: 'Send DSA report email',
			description: 'Initiates DSA (Digital Services Act) report submission by sending verification email to reporter.',
			responseSchema: OkResponse,
			statusCode: 200,
			security: [],
			tags: 'Reports',
		}),
		Validator('json', DsaReportEmailSendRequest),
		async (ctx) => {
			await ctx.get('reportRequestService').sendDsaReportVerificationEmail({data: ctx.req.valid('json')});
			return ctx.json({ok: true});
		},
	);

	app.post(
		'/reports/dsa/email/verify',
		RateLimitMiddleware(RateLimitConfigs.DSA_REPORT_EMAIL_VERIFY),
		OpenAPI({
			operationId: 'verify_dsa_report_email',
			summary: 'Verify DSA report email',
			description: 'Verifies the DSA report email and creates a report ticket for legal compliance.',
			responseSchema: TicketResponse,
			statusCode: 200,
			security: [],
			tags: 'Reports',
		}),
		Validator('json', DsaReportEmailVerifyRequest),
		async (ctx) => {
			return ctx.json(await ctx.get('reportRequestService').verifyDsaReportEmail({data: ctx.req.valid('json')}));
		},
	);

	app.post(
		'/reports/dsa',
		RateLimitMiddleware(RateLimitConfigs.DSA_REPORT_CREATE),
		OpenAPI({
			operationId: 'create_dsa_report',
			summary: 'Create DSA report',
			description: 'Creates a DSA complaint report with verified email for Digital Services Act compliance.',
			responseSchema: ReportResponse,
			statusCode: 200,
			security: [],
			tags: 'Reports',
		}),
		Validator('json', DsaReportRequest),
		async (ctx) => {
			return ctx.json(await ctx.get('reportRequestService').createDsaReport({data: ctx.req.valid('json')}));
		},
	);
}
