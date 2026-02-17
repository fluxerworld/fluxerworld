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

import {createReportID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {CsamEvidenceRetentionService} from '@fluxer/api/src/csam/CsamEvidenceRetentionService';
import type {CsamLegalHoldService} from '@fluxer/api/src/csam/CsamLegalHoldService';
import type {NcmecSubmissionService} from '@fluxer/api/src/csam/NcmecSubmissionService';
import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {MS_PER_DAY} from '@fluxer/date_utils/src/DateConstants';
import {
	LegalHoldRequest,
	LegalHoldResponse,
	NcmecSubmissionStatusResponse,
	NcmecSubmitResultResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {ReportIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';

export function ChildSafetyAdminController(app: HonoApp) {
	app.get(
		'/admin/reports/:report_id/legal-hold',
		requireAdminACL(AdminACLs.REPORT_VIEW),
		Validator('param', ReportIdParam),
		OpenAPI({
			operationId: 'get_legal_hold_status',
			summary: 'Get legal hold status',
			description:
				'Retrieve the current legal hold status of a report. Indicates whether evidence is preserved for legal proceedings and the hold expiration date if set.',
			responseSchema: LegalHoldResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const service = ctx.get('csamLegalHoldService') as CsamLegalHoldService;
			const {report_id} = ctx.req.valid('param');
			const held = await service.isHeld(report_id.toString());
			return ctx.json({held});
		},
	);

	app.post(
		'/admin/reports/:report_id/legal-hold',
		requireAdminACL(AdminACLs.REPORT_RESOLVE),
		Validator('param', ReportIdParam),
		Validator('json', LegalHoldRequest),
		OpenAPI({
			operationId: 'set_legal_hold_on_evidence',
			summary: 'Set legal hold on evidence',
			description:
				'Place a legal hold on report evidence to prevent automatic deletion. Used for compliance with legal investigations or regulatory requirements. Optionally specify an expiration date.',
			responseSchema: LegalHoldResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const service = ctx.get('csamLegalHoldService') as CsamLegalHoldService;
			const retentionService = ctx.get('csamEvidenceRetentionService') as CsamEvidenceRetentionService;
			const {report_id} = ctx.req.valid('param');
			const reportIdString = report_id.toString();
			const {expires_at} = ctx.req.valid('json');
			const expiresAt = expires_at ? new Date(expires_at) : undefined;
			await service.hold(reportIdString, expiresAt);
			const expiresParam = expiresAt ?? null;
			await retentionService.rescheduleForHold(report_id, expiresParam);
			return ctx.json({held: true});
		},
	);

	app.delete(
		'/admin/reports/:report_id/legal-hold',
		requireAdminACL(AdminACLs.REPORT_RESOLVE),
		Validator('param', ReportIdParam),
		OpenAPI({
			operationId: 'release_legal_hold_on_evidence',
			summary: 'Release legal hold on evidence',
			description:
				'Remove a legal hold on a report. Evidence becomes eligible for automatic deletion per the retention policy. Used after legal matters are resolved.',
			responseSchema: LegalHoldResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const service = ctx.get('csamLegalHoldService') as CsamLegalHoldService;
			const retentionService = ctx.get('csamEvidenceRetentionService') as CsamEvidenceRetentionService;
			const {report_id} = ctx.req.valid('param');
			const reportIdString = report_id.toString();
			await service.release(reportIdString);
			const retentionMs = Math.max(1, Config.csam.evidenceRetentionDays) * MS_PER_DAY;
			await retentionService.rescheduleExpiration(report_id, new Date(Date.now() + retentionMs));
			return ctx.json({held: false});
		},
	);

	app.get(
		'/admin/reports/:report_id/ncmec-status',
		requireAdminACL(AdminACLs.REPORT_VIEW),
		Validator('param', ReportIdParam),
		OpenAPI({
			operationId: 'get_ncmec_submission_status',
			summary: 'Get NCMEC submission status',
			description:
				'Retrieve the submission status of a report to the National Center for Missing & Exploited Children. Shows whether the report has been submitted and the current status with NCMEC.',
			responseSchema: NcmecSubmissionStatusResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const service = ctx.get('ncmecSubmissionService') as NcmecSubmissionService;
			const {report_id} = ctx.req.valid('param');
			const reportId = createReportID(report_id);
			const status = await service.getSubmissionStatus(reportId);
			return ctx.json(status);
		},
	);

	app.post(
		'/admin/reports/:report_id/ncmec-submit',
		requireAdminACL(AdminACLs.CSAM_SUBMIT_NCMEC),
		Validator('param', ReportIdParam),
		OpenAPI({
			operationId: 'submit_report_to_ncmec',
			summary: 'Submit report to NCMEC',
			description:
				'Manually submit a child safety report to the National Center for Missing & Exploited Children. Requires explicit authorization and includes evidence packaging. Can only be done once per report.',
			responseSchema: NcmecSubmitResultResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const service = ctx.get('ncmecSubmissionService') as NcmecSubmissionService;
			const adminUserId = ctx.get('adminUserId');
			const {report_id} = ctx.req.valid('param');
			const reportId = createReportID(report_id);
			const result = await service.submitToNcmec(reportId, adminUserId);
			return ctx.json(result);
		},
	);
}
