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

import {generateGiftCodes} from '@fluxer/admin/src/api/Codes';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {GiftCodesPage} from '@fluxer/admin/src/pages/GiftCodesPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {getPageConfig, isSelfHostedOverride} from '@fluxer/admin/src/SelfHostedOverride';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {getOptionalString, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {Hono} from 'hono';

export function createCodesRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/gift-codes', requireAuth, async (c) => {
		if (isSelfHostedOverride(c, config)) {
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: 'Gift codes are not available on self-hosted instances',
				type: 'error',
			});
		}

		const pageConfig = getPageConfig(c, config);
		const {session, currentAdmin, flash, adminAcls, csrfToken} = getRouteContext(c);
		const codesParam = c.req.query('codes');
		const generatedCodes = codesParam ? codesParam.split(',') : undefined;

		return c.html(
			<GiftCodesPage
				config={pageConfig}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
				adminAcls={adminAcls}
				csrfToken={csrfToken}
				generatedCodes={generatedCodes}
			/>,
		);
	});

	router.post('/gift-codes', requireAuth, async (c) => {
		if (isSelfHostedOverride(c, config)) {
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: 'Gift codes are not available on self-hosted instances',
				type: 'error',
			});
		}

		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/gift-codes`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const countStr = getOptionalString(formData, 'count');
			const count = countStr ? parseInt(countStr, 10) || 1 : 1;
			const productType = getOptionalString(formData, 'product_type') || 'premium_monthly';

			const result = await generateGiftCodes(config, session, count, productType);
			if (result.ok) {
				return redirectWithFlash(c, `${redirectUrl}?codes=${encodeURIComponent(result.data.join(','))}`, {
					message: `Generated ${result.data.length} gift code(s)`,
					type: 'success',
				});
			}
			return redirectWithFlash(c, redirectUrl, {message: 'Failed to generate gift codes', type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	return router;
}
