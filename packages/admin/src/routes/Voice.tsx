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
	type CreateVoiceRegionParams,
	type CreateVoiceServerParams,
	createVoiceRegion,
	createVoiceServer,
	deleteVoiceRegion,
	deleteVoiceServer,
	type UpdateVoiceRegionParams,
	type UpdateVoiceServerParams,
	updateVoiceRegion,
	updateVoiceServer,
} from '@fluxer/admin/src/api/Voice';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {VoiceRegionsPage} from '@fluxer/admin/src/pages/VoiceRegionsPage';
import {VoiceServersPage} from '@fluxer/admin/src/pages/VoiceServersPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {getPageConfig} from '@fluxer/admin/src/SelfHostedOverride';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {getOptionalString, getRequiredString, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {Hono} from 'hono';

export function createVoiceRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/voice-regions', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);

		const page = await VoiceRegionsPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			assetVersion,
			csrfToken,
		});
		return c.html(page ?? '');
	});

	router.post('/voice-regions', requireAuth, async (c) => {
		const session = c.get('session')!;
		const redirectUrl = `${config.basePath}/voice-regions`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const action = c.req.query('action');

			if (action === 'create') {
				const latitudeStr = getOptionalString(formData, 'latitude') || '0';
				const longitudeStr = getOptionalString(formData, 'longitude') || '0';
				const requiredGuildFeaturesStr = getOptionalString(formData, 'required_guild_features') || '';
				const allowedGuildIdsStr = getOptionalString(formData, 'allowed_guild_ids') || '';
				const allowedUserIdsStr = getOptionalString(formData, 'allowed_user_ids') || '';

				const params: CreateVoiceRegionParams = {
					id: getRequiredString(formData, 'id') || '',
					name: getRequiredString(formData, 'name') || '',
					emoji: getOptionalString(formData, 'emoji') || '',
					latitude: parseFloat(latitudeStr),
					longitude: parseFloat(longitudeStr),
					is_default: getOptionalString(formData, 'is_default') === 'true',
					vip_only: getOptionalString(formData, 'vip_only') === 'true',
					required_guild_features: requiredGuildFeaturesStr
						.split(/[\n,]/)
						.map((f) => f.trim())
						.filter((f) => f !== ''),
					allowed_guild_ids: allowedGuildIdsStr
						.split(/[\n,]/)
						.map((id) => id.trim())
						.filter((id) => id !== ''),
					allowed_user_ids: allowedUserIdsStr
						.split(/[\n,]/)
						.map((id) => id.trim())
						.filter((id) => id !== ''),
				};

				const result = await createVoiceRegion(config, session, params);
				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'Voice region created' : 'Failed to create voice region',
					type: result.ok ? 'success' : 'error',
				});
			}

			if (action === 'update') {
				const latitudeStr = getOptionalString(formData, 'latitude') || '0';
				const longitudeStr = getOptionalString(formData, 'longitude') || '0';
				const requiredGuildFeaturesStr = getOptionalString(formData, 'required_guild_features') || '';
				const allowedGuildIdsStr = getOptionalString(formData, 'allowed_guild_ids') || '';
				const allowedUserIdsStr = getOptionalString(formData, 'allowed_user_ids') || '';

				const params: UpdateVoiceRegionParams = {
					id: getRequiredString(formData, 'id') || '',
					name: getRequiredString(formData, 'name') || '',
					emoji: getOptionalString(formData, 'emoji') || '',
					latitude: parseFloat(latitudeStr),
					longitude: parseFloat(longitudeStr),
					is_default: getOptionalString(formData, 'is_default') === 'true',
					vip_only: getOptionalString(formData, 'vip_only') === 'true',
					required_guild_features: requiredGuildFeaturesStr
						.split(/[\n,]/)
						.map((f) => f.trim())
						.filter((f) => f !== ''),
					allowed_guild_ids: allowedGuildIdsStr
						.split(/[\n,]/)
						.map((id) => id.trim())
						.filter((id) => id !== ''),
					allowed_user_ids: allowedUserIdsStr
						.split(/[\n,]/)
						.map((id) => id.trim())
						.filter((id) => id !== ''),
				};

				const result = await updateVoiceRegion(config, session, params);
				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'Voice region updated' : 'Failed to update voice region',
					type: result.ok ? 'success' : 'error',
				});
			}

			if (action === 'delete') {
				const id = getRequiredString(formData, 'id');
				if (!id) {
					return redirectWithFlash(c, redirectUrl, {message: 'Region ID is required', type: 'error'});
				}
				const result = await deleteVoiceRegion(config, session, id);
				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'Voice region deleted' : 'Failed to delete voice region',
					type: result.ok ? 'success' : 'error',
				});
			}

			return redirectWithFlash(c, redirectUrl, {message: 'Unknown action', type: 'error'});
		} catch {
			return redirectWithFlash(c, redirectUrl, {message: 'Invalid form data', type: 'error'});
		}
	});

	router.get('/voice-servers', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);
		const regionId = c.req.query('region_id');

		const page = await VoiceServersPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			assetVersion,
			regionId,
			csrfToken,
		});
		return c.html(page ?? '');
	});

	router.post('/voice-servers', requireAuth, async (c) => {
		const session = c.get('session')!;
		const regionId = c.req.query('region_id');
		const redirectUrl = `${config.basePath}/voice-servers${regionId ? `?region_id=${regionId}` : ''}`;

		try {
			const formData = (await c.req.parseBody()) as ParsedBody;
			const action = c.req.query('action');

			if (action === 'create') {
				const requiredGuildFeaturesStr = getOptionalString(formData, 'required_guild_features') || '';
				const allowedGuildIdsStr = getOptionalString(formData, 'allowed_guild_ids') || '';
				const allowedUserIdsStr = getOptionalString(formData, 'allowed_user_ids') || '';

				const params: CreateVoiceServerParams = {
					region_id: getRequiredString(formData, 'region_id') || '',
					server_id: getRequiredString(formData, 'server_id') || '',
					endpoint: getRequiredString(formData, 'endpoint') || '',
					api_key: getRequiredString(formData, 'api_key') || '',
					api_secret: getRequiredString(formData, 'api_secret') || '',
					is_active: getOptionalString(formData, 'is_active') === 'true',
					vip_only: getOptionalString(formData, 'vip_only') === 'true',
					required_guild_features: requiredGuildFeaturesStr
						.split(/[\n,]/)
						.map((f) => f.trim())
						.filter((f) => f !== ''),
					allowed_guild_ids: allowedGuildIdsStr
						.split(/[\n,]/)
						.map((id) => id.trim())
						.filter((id) => id !== ''),
					allowed_user_ids: allowedUserIdsStr
						.split(/[\n,]/)
						.map((id) => id.trim())
						.filter((id) => id !== ''),
				};

				const result = await createVoiceServer(config, session, params);
				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'Voice server created' : 'Failed to create voice server',
					type: result.ok ? 'success' : 'error',
				});
			}

			if (action === 'update') {
				const requiredGuildFeaturesStr = getOptionalString(formData, 'required_guild_features') || '';
				const allowedGuildIdsStr = getOptionalString(formData, 'allowed_guild_ids') || '';
				const allowedUserIdsStr = getOptionalString(formData, 'allowed_user_ids') || '';

				const params: UpdateVoiceServerParams = {
					region_id: getRequiredString(formData, 'region_id') || '',
					server_id: getRequiredString(formData, 'server_id') || '',
					endpoint: getRequiredString(formData, 'endpoint') || '',
					is_active: getOptionalString(formData, 'is_active') === 'true',
					vip_only: getOptionalString(formData, 'vip_only') === 'true',
					required_guild_features: requiredGuildFeaturesStr
						.split(/[\n,]/)
						.map((f) => f.trim())
						.filter((f) => f !== ''),
					allowed_guild_ids: allowedGuildIdsStr
						.split(/[\n,]/)
						.map((id) => id.trim())
						.filter((id) => id !== ''),
					allowed_user_ids: allowedUserIdsStr
						.split(/[\n,]/)
						.map((id) => id.trim())
						.filter((id) => id !== ''),
				};

				const result = await updateVoiceServer(config, session, params);
				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'Voice server updated' : 'Failed to update voice server',
					type: result.ok ? 'success' : 'error',
				});
			}

			if (action === 'delete') {
				const serverRegionId = getRequiredString(formData, 'region_id');
				const serverId = getRequiredString(formData, 'server_id');
				if (!serverRegionId || !serverId) {
					return redirectWithFlash(c, redirectUrl, {message: 'Region ID and Server ID are required', type: 'error'});
				}
				const result = await deleteVoiceServer(config, session, serverRegionId, serverId);
				return redirectWithFlash(c, redirectUrl, {
					message: result.ok ? 'Voice server deleted' : 'Failed to delete voice server',
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
