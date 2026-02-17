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

import * as bansApi from '@fluxer/admin/src/api/Bans';
import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {BanManagementPage, type BanType, getBanConfig} from '@fluxer/admin/src/pages/BanManagementPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {getPageConfig} from '@fluxer/admin/src/SelfHostedOverride';
import type {AppContext, AppVariables, Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {getOptionalString, getRequiredString, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {Hono} from 'hono';

async function handleBanAction(
	c: AppContext,
	config: Config,
	banType: BanType,
	action: string | undefined,
	value: string,
	session: Session,
	auditLogReason: string | undefined,
): Promise<Response> {
	const banConfig = getBanConfig(banType);

	if (action === 'ban') {
		const result =
			banType === 'ip'
				? await bansApi.banIp(config, session, value, auditLogReason)
				: banType === 'email'
					? await bansApi.banEmail(config, session, value, auditLogReason)
					: await bansApi.banPhone(config, session, value, auditLogReason);

		if (result.ok) {
			return redirectWithFlash(c, `${config.basePath}${banConfig.route}`, {
				message: `${banConfig.entityName} ${value} banned successfully`,
				type: 'success',
			});
		} else {
			return redirectWithFlash(c, `${config.basePath}${banConfig.route}`, {
				message: `Failed to ban ${banConfig.entityName} ${value}`,
				type: 'error',
			});
		}
	}

	if (action === 'unban') {
		const result =
			banType === 'ip'
				? await bansApi.unbanIp(config, session, value, auditLogReason)
				: banType === 'email'
					? await bansApi.unbanEmail(config, session, value, auditLogReason)
					: await bansApi.unbanPhone(config, session, value, auditLogReason);

		if (result.ok) {
			return redirectWithFlash(c, `${config.basePath}${banConfig.route}`, {
				message: `${banConfig.entityName} ${value} unbanned successfully`,
				type: 'success',
			});
		} else {
			return redirectWithFlash(c, `${config.basePath}${banConfig.route}`, {
				message: `Failed to unban ${banConfig.entityName} ${value}`,
				type: 'error',
			});
		}
	}

	if (action === 'check') {
		const result =
			banType === 'ip'
				? await bansApi.checkIpBan(config, session, value)
				: banType === 'email'
					? await bansApi.checkEmailBan(config, session, value)
					: await bansApi.checkPhoneBan(config, session, value);

		if (result.ok) {
			if (result.data.banned) {
				return redirectWithFlash(c, `${config.basePath}${banConfig.route}`, {
					message: `${banConfig.entityName} ${value} is banned`,
					type: 'info',
				});
			} else {
				return redirectWithFlash(c, `${config.basePath}${banConfig.route}`, {
					message: `${banConfig.entityName} ${value} is NOT banned`,
					type: 'info',
				});
			}
		} else {
			return redirectWithFlash(c, `${config.basePath}${banConfig.route}`, {
				message: 'Error checking ban status',
				type: 'error',
			});
		}
	}

	return c.redirect(`${config.basePath}${banConfig.route}`);
}

export function createBansRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/ip-bans', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);
		const listResult = await bansApi.listIpBans(config, session, 200);

		return c.html(
			<BanManagementPage
				config={pageConfig}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
				banType="ip"
				listResult={
					listResult.ok
						? {
								ok: true,
								bans: listResult.data.bans.map((b) => ({value: b.ip, reverseDns: b.reverse_dns})),
							}
						: {ok: false, errorMessage: getErrorMessage(listResult.error)}
				}
				csrfToken={csrfToken}
			/>,
		);
	});

	router.post('/ip-bans', requireAuth, async (c) => {
		const session = c.get('session')!;
		const action = c.req.query('action');
		const formData = (await c.req.parseBody()) as ParsedBody;
		const ip = getRequiredString(formData, 'ip');
		const auditLogReason = getOptionalString(formData, 'audit_log_reason');

		if (!ip) {
			return c.redirect(`${config.basePath}/ip-bans`);
		}

		return handleBanAction(c, config, 'ip', action, ip, session, auditLogReason);
	});

	router.get('/email-bans', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);
		const listResult = await bansApi.listEmailBans(config, session, 200);

		return c.html(
			<BanManagementPage
				config={pageConfig}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
				banType="email"
				listResult={
					listResult.ok
						? {ok: true, bans: listResult.data.bans.map((value) => ({value}))}
						: {ok: false, errorMessage: getErrorMessage(listResult.error)}
				}
				csrfToken={csrfToken}
			/>,
		);
	});

	router.post('/email-bans', requireAuth, async (c) => {
		const session = c.get('session')!;
		const action = c.req.query('action');
		const formData = (await c.req.parseBody()) as ParsedBody;
		const email = getRequiredString(formData, 'email');
		const auditLogReason = getOptionalString(formData, 'audit_log_reason');

		if (!email) {
			return c.redirect(`${config.basePath}/email-bans`);
		}

		return handleBanAction(c, config, 'email', action, email, session, auditLogReason);
	});

	router.get('/phone-bans', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);
		const listResult = await bansApi.listPhoneBans(config, session, 200);

		return c.html(
			<BanManagementPage
				config={pageConfig}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
				banType="phone"
				listResult={
					listResult.ok
						? {ok: true, bans: listResult.data.bans.map((value) => ({value}))}
						: {ok: false, errorMessage: getErrorMessage(listResult.error)}
				}
				csrfToken={csrfToken}
			/>,
		);
	});

	router.post('/phone-bans', requireAuth, async (c) => {
		const session = c.get('session')!;
		const action = c.req.query('action');
		const formData = (await c.req.parseBody()) as ParsedBody;
		const phone = getRequiredString(formData, 'phone');
		const auditLogReason = getOptionalString(formData, 'audit_log_reason');

		if (!phone) {
			return c.redirect(`${config.basePath}/phone-bans`);
		}

		return handleBanAction(c, config, 'phone', action, phone, session, auditLogReason);
	});

	return router;
}
