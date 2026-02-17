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

import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {getReportDetail, resolveReport} from '@fluxer/admin/src/api/Reports';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {ReportDetailFragment, ReportDetailPage} from '@fluxer/admin/src/pages/ReportDetailPage';
import {ReportsPage} from '@fluxer/admin/src/pages/ReportsPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {getPageConfig} from '@fluxer/admin/src/SelfHostedOverride';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {getOptionalString, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {Hono} from 'hono';

export function createReportsRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/reports', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);

		const query = c.req.query('q');
		const page = parseInt(c.req.query('page') ?? '0', 10);
		const limit = parseInt(c.req.query('limit') ?? '25', 10);
		const statusParam = c.req.query('status');
		const typeParam = c.req.query('type');
		const categoryFilter = c.req.query('category');
		const sort = c.req.query('sort');

		const statusFilter = statusParam ? parseInt(statusParam, 10) : undefined;
		const typeFilter = typeParam ? parseInt(typeParam, 10) : undefined;

		const pageResult = await ReportsPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			assetVersion,
			query,
			page,
			limit,
			statusFilter,
			typeFilter,
			categoryFilter,
			sort,
			csrfToken,
		});
		return c.html(pageResult ?? '');
	});

	router.get('/reports/:reportId', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);
		const reportId = c.req.param('reportId');

		const reportResult = await getReportDetail(config, session, reportId);
		if (!reportResult.ok) {
			return redirectWithFlash(c, `${config.basePath}/reports`, {
				message: getErrorMessage(reportResult.error),
				type: 'error',
			});
		}

		return c.html(
			<ReportDetailPage
				config={pageConfig}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				report={reportResult.data}
				assetVersion={assetVersion}
				csrfToken={csrfToken}
			/>,
		);
	});

	router.get('/reports/:reportId/fragment', requireAuth, async (c) => {
		const session = c.get('session')!;
		const pageConfig = getPageConfig(c, config);
		const reportId = c.req.param('reportId');

		const reportResult = await getReportDetail(config, session, reportId);
		if (!reportResult.ok) {
			return c.html(
				<div data-report-fragment="" class="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
					Failed to load report: {getErrorMessage(reportResult.error)}
				</div>,
			);
		}

		return c.html(<ReportDetailFragment config={pageConfig} report={reportResult.data} />);
	});

	router.post('/reports/:reportId/resolve', requireAuth, async (c) => {
		const session = c.get('session')!;
		const reportId = c.req.param('reportId');
		const redirectUrl = `${config.basePath}/reports/${reportId}`;
		const isBackground = c.req.query('background') === '1';

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const publicComment = getOptionalString(formData, 'public_comment');
			const auditLogReason = getOptionalString(formData, 'audit_log_reason');

			const result = await resolveReport(config, session, reportId, publicComment, auditLogReason);
			if (isBackground) {
				if (!result.ok) {
					return c.text(getErrorMessage(result.error), 400);
				}
				return c.body(null, 204);
			}

			return redirectWithFlash(c, redirectUrl, {
				message: result.ok ? 'Report resolved' : getErrorMessage(result.error),
				type: result.ok ? 'success' : 'error',
			});
		} catch {
			if (isBackground) {
				return c.text('Invalid form data', 400);
			}
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	return router;
}
