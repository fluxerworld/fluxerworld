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
	expandVisionarySlots,
	listVisionarySlots,
	reserveVisionarySlot,
	shrinkVisionarySlots,
	swapVisionarySlots,
} from '@fluxer/admin/src/api/VisionarySlots';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {VisionarySlotsPage} from '@fluxer/admin/src/pages/VisionarySlotsPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {getPageConfig, isSelfHostedOverride} from '@fluxer/admin/src/SelfHostedOverride';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {getOptionalString, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {Hono} from 'hono';

export function createVisionarySlotsRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/visionary-slots', requireAuth, async (c) => {
		if (isSelfHostedOverride(c, config)) {
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: 'Visionary slots are not available on self-hosted instances',
				type: 'error',
			});
		}

		const pageConfig = getPageConfig(c, config);
		const {session, currentAdmin, flash, adminAcls, csrfToken} = getRouteContext(c);

		const result = await listVisionarySlots(config, session);
		if (!result.ok) {
			const errorMessage =
				result.error && 'message' in result.error ? result.error.message : 'Failed to load visionary slots';
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: errorMessage,
				type: 'error',
			});
		}

		const sortedSlots = result.data.slots.sort((a, b) => a.slot_index - b.slot_index);

		return c.html(
			<VisionarySlotsPage
				config={pageConfig}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
				adminAcls={adminAcls}
				csrfToken={csrfToken}
				slots={sortedSlots}
				totalCount={result.data.total_count}
				reservedCount={result.data.reserved_count}
			/>,
		);
	});

	router.post('/visionary-slots/expand', requireAuth, async (c) => {
		if (isSelfHostedOverride(c, config)) {
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: 'Visionary slots are not available on self-hosted instances',
				type: 'error',
			});
		}

		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/visionary-slots`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const countStr = getOptionalString(formData, 'count');
			const count = countStr ? parseInt(countStr, 10) || 1 : 1;

			const result = await expandVisionarySlots(config, session, count);
			if (result.ok) {
				return redirectWithFlash(c, redirectUrl, {
					message: `Successfully added ${count} visionary slot(s)`,
					type: 'success',
				});
			}
			return redirectWithFlash(c, redirectUrl, {message: 'Failed to expand visionary slots', type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	router.post('/visionary-slots/shrink', requireAuth, async (c) => {
		if (isSelfHostedOverride(c, config)) {
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: 'Visionary slots are not available on self-hosted instances',
				type: 'error',
			});
		}

		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/visionary-slots`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const targetCountStr = getOptionalString(formData, 'target_count');
			const targetCount = targetCountStr ? parseInt(targetCountStr, 10) || 0 : 0;

			const result = await shrinkVisionarySlots(config, session, targetCount);
			if (result.ok) {
				return redirectWithFlash(c, redirectUrl, {
					message: `Successfully shrunk visionary slots to ${targetCount}`,
					type: 'success',
				});
			}
			return redirectWithFlash(c, redirectUrl, {message: 'Failed to shrink visionary slots', type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	router.post('/visionary-slots/reserve', requireAuth, async (c) => {
		if (isSelfHostedOverride(c, config)) {
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: 'Visionary slots are not available on self-hosted instances',
				type: 'error',
			});
		}

		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/visionary-slots`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const slotIndexStr = getOptionalString(formData, 'slot_index');
			const slotIndex = slotIndexStr ? parseInt(slotIndexStr, 10) : 0;
			const userIdRaw = getOptionalString(formData, 'user_id');

			let userId: string | null = null;
			if (userIdRaw && userIdRaw !== 'null' && userIdRaw.trim() !== '') {
				userId = userIdRaw.trim();
			}

			const result = await reserveVisionarySlot(config, session, slotIndex, userId);
			if (result.ok) {
				const action = userId ? 'reserved' : 'unreserved';
				return redirectWithFlash(c, redirectUrl, {
					message: `Successfully ${action} slot ${slotIndex}`,
					type: 'success',
				});
			}
			return redirectWithFlash(c, redirectUrl, {message: 'Failed to update slot reservation', type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	router.post('/visionary-slots/swap', requireAuth, async (c) => {
		if (isSelfHostedOverride(c, config)) {
			return redirectWithFlash(c, `${config.basePath}/dashboard`, {
				message: 'Visionary slots are not available on self-hosted instances',
				type: 'error',
			});
		}

		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/visionary-slots`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const slotIndexAStr = getOptionalString(formData, 'slot_index_a');
			const slotIndexBStr = getOptionalString(formData, 'slot_index_b');
			const slotIndexA = slotIndexAStr ? parseInt(slotIndexAStr, 10) : 0;
			const slotIndexB = slotIndexBStr ? parseInt(slotIndexBStr, 10) : 0;

			const result = await swapVisionarySlots(config, session, slotIndexA, slotIndexB);
			if (result.ok) {
				return redirectWithFlash(c, redirectUrl, {
					message: `Successfully swapped slots ${slotIndexA} and ${slotIndexB}`,
					type: 'success',
				});
			}
			return redirectWithFlash(c, redirectUrl, {message: 'Failed to swap slots', type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	return router;
}
