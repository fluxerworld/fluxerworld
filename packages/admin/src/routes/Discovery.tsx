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

import {
	approveDiscoveryApplication,
	listDiscoveryApplications,
	rejectDiscoveryApplication,
	removeFromDiscovery,
} from '@fluxer/admin/src/api/Discovery';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {DiscoveryPage} from '@fluxer/admin/src/pages/DiscoveryPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {getOptionalString, getRequiredString, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {Hono} from 'hono';

export function createDiscoveryRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/discovery', requireAuth, async (c) => {
		const {session, currentAdmin, flash, adminAcls, csrfToken} = getRouteContext(c);
		const status = c.req.query('status') ?? 'pending';
		const validStatuses = ['pending', 'approved', 'rejected', 'removed'];
		const currentStatus = validStatuses.includes(status) ? status : 'pending';

		const result = await listDiscoveryApplications(config, session, currentStatus);
		if (!result.ok) {
			const errorMessage =
				result.error && 'message' in result.error ? result.error.message : 'Failed to load discovery applications';
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: errorMessage,
				type: 'error',
			});
		}

		return c.html(
			<DiscoveryPage
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
				adminAcls={adminAcls}
				csrfToken={csrfToken}
				applications={result.data}
				currentStatus={currentStatus}
			/>,
		);
	});

	router.post('/discovery/approve', requireAuth, async (c) => {
		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/discovery?status=pending`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const guildId = getRequiredString(formData, 'guild_id');
			if (!guildId) {
				return redirectWithFlash(c, redirectUrl, {message: 'Guild ID is required', type: 'error'});
			}

			const reason = getOptionalString(formData, 'reason');
			const result = await approveDiscoveryApplication(config, session, guildId, reason);
			if (result.ok) {
				return redirectWithFlash(c, redirectUrl, {
					message: `Successfully approved guild ${guildId} for discovery`,
					type: 'success',
				});
			}

			const errorMessage =
				result.error && 'message' in result.error ? result.error.message : 'Failed to approve application';
			return redirectWithFlash(c, redirectUrl, {message: errorMessage, type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	router.post('/discovery/reject', requireAuth, async (c) => {
		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/discovery?status=pending`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const guildId = getRequiredString(formData, 'guild_id');
			if (!guildId) {
				return redirectWithFlash(c, redirectUrl, {message: 'Guild ID is required', type: 'error'});
			}

			const reason = getRequiredString(formData, 'reason');
			if (!reason) {
				return redirectWithFlash(c, redirectUrl, {message: 'A reason is required for rejection', type: 'error'});
			}

			const result = await rejectDiscoveryApplication(config, session, guildId, reason);
			if (result.ok) {
				return redirectWithFlash(c, redirectUrl, {
					message: `Successfully rejected guild ${guildId}`,
					type: 'success',
				});
			}

			const errorMessage =
				result.error && 'message' in result.error ? result.error.message : 'Failed to reject application';
			return redirectWithFlash(c, redirectUrl, {message: errorMessage, type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	router.post('/discovery/remove', requireAuth, async (c) => {
		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/discovery?status=approved`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const guildId = getRequiredString(formData, 'guild_id');
			if (!guildId) {
				return redirectWithFlash(c, redirectUrl, {message: 'Guild ID is required', type: 'error'});
			}

			const reason = getRequiredString(formData, 'reason');
			if (!reason) {
				return redirectWithFlash(c, redirectUrl, {message: 'A reason is required for removal', type: 'error'});
			}

			const result = await removeFromDiscovery(config, session, guildId, reason);
			if (result.ok) {
				return redirectWithFlash(c, redirectUrl, {
					message: `Successfully removed guild ${guildId} from discovery`,
					type: 'success',
				});
			}

			const errorMessage =
				result.error && 'message' in result.error ? result.error.message : 'Failed to remove from discovery';
			return redirectWithFlash(c, redirectUrl, {message: errorMessage, type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	return router;
}
