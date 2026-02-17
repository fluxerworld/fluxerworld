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

import {createApiKey, revokeApiKey} from '@fluxer/admin/src/api/AdminApiKeys';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {AdminApiKeysPage} from '@fluxer/admin/src/pages/AdminApiKeysPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {getPageConfig} from '@fluxer/admin/src/SelfHostedOverride';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {getRequiredString, getStringArray, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {Hono} from 'hono';

export function createAdminRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/admin-api-keys', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);

		const page = await AdminApiKeysPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			assetVersion,
			createdKey: undefined,
			flashAfterAction: undefined,
			csrfToken,
		});
		return c.html(page ?? '');
	});

	router.post('/admin-api-keys', requireAuth, async (c) => {
		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/admin-api-keys`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const action = c.req.query('action');

			if (action === 'create') {
				const name = getRequiredString(formData, 'name');
				const acls = getStringArray(formData, 'acls[]');

				if (!name) {
					return redirectWithFlash(c, redirectUrl, {message: 'Name is required', type: 'error'});
				}

				const result = await createApiKey(config, session, name, acls);
				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: "API key created successfully. Copy the key now — it won't be shown again.",
						type: 'success',
						detail: result.data.key,
					});
				}
				return redirectWithFlash(c, redirectUrl, {message: 'Failed to create API key', type: 'error'});
			}

			if (action === 'revoke') {
				const keyId = getRequiredString(formData, 'key_id');
				if (!keyId) {
					return redirectWithFlash(c, redirectUrl, {message: 'Key ID is required', type: 'error'});
				}
				const result = await revokeApiKey(config, session, keyId);
				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'API key revoked' : 'Failed to revoke API key',
					type: result.ok ? 'success' : 'error',
				});
			}

			return redirectWithFlash(c, redirectUrl, {message: 'Unknown action', type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	return router;
}
