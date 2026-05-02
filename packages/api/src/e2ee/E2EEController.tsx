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

import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {UserIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	E2EEDeviceListResponse,
	E2EEDeviceResponse,
	E2EEPrekeyBundleListResponse,
	RegisterDeviceRequest,
	RotateSignedPrekeyRequest,
	TopUpOneTimePrekeysRequest,
} from '@fluxer/schema/src/domains/e2ee/E2EESchemas';
import {z} from 'zod';

const DeviceIdParam = z.object({
	device_id: z.string().min(8).max(64),
});

export function E2EEController(app: HonoApp): void {
	app.get(
		'/users/@me/e2ee/devices',
		RateLimitMiddleware(RateLimitConfigs.USER_E2EE_LIST_DEVICES),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_e2ee_devices',
			summary: 'List own end-to-end encryption devices',
			responseSchema: E2EEDeviceListResponse,
			statusCode: 200,
			security: ['sessionToken', 'bearerToken'],
			tags: ['E2EE'],
			description:
				'Returns every E2EE device registered for the current user, including identity key, current signed prekey, and remaining one-time prekey count.',
		}),
		async (ctx) => {
			const devices = await ctx.get('e2eeService').listOwnDevices(ctx.get('user').id);
			return ctx.json(devices);
		},
	);

	app.post(
		'/users/@me/e2ee/devices',
		RateLimitMiddleware(RateLimitConfigs.USER_E2EE_REGISTER_DEVICE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', RegisterDeviceRequest),
		OpenAPI({
			operationId: 'register_e2ee_device',
			summary: 'Register an end-to-end encryption device',
			responseSchema: E2EEDeviceResponse,
			statusCode: 200,
			security: ['sessionToken', 'bearerToken'],
			tags: ['E2EE'],
			description:
				"Publishes the device's long-term identity key, current signed prekey (signed by the identity key), and an initial pool of one-time prekeys. Re-posting with the same device_id replaces the previous entry — the client can use this to rotate everything at once after a key compromise.",
		}),
		async (ctx) => {
			const device = await ctx.get('e2eeService').registerDevice(ctx.get('user').id, ctx.req.valid('json'));
			return ctx.json(device);
		},
	);

	app.delete(
		'/users/@me/e2ee/devices/:device_id',
		RateLimitMiddleware(RateLimitConfigs.USER_E2EE_DELETE_DEVICE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', DeviceIdParam),
		OpenAPI({
			operationId: 'delete_e2ee_device',
			summary: 'Remove an end-to-end encryption device',
			responseSchema: z.object({success: z.boolean()}),
			statusCode: 200,
			security: ['sessionToken', 'bearerToken'],
			tags: ['E2EE'],
			description:
				'Removes the device entry and all associated one-time prekeys. Future senders can no longer establish new sessions with this device, though existing sessions will continue to work until the recipient client also drops them.',
		}),
		async (ctx) => {
			const ok = await ctx
				.get('e2eeService')
				.deleteOwnDevice(ctx.get('user').id, ctx.req.valid('param').device_id);
			return ctx.json({success: ok});
		},
	);

	app.put(
		'/users/@me/e2ee/devices/:device_id/signed-prekey',
		RateLimitMiddleware(RateLimitConfigs.USER_E2EE_ROTATE_PREKEY),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', DeviceIdParam),
		Validator('json', RotateSignedPrekeyRequest),
		OpenAPI({
			operationId: 'rotate_e2ee_signed_prekey',
			summary: 'Rotate the device signed prekey',
			responseSchema: E2EEDeviceResponse,
			statusCode: 200,
			security: ['sessionToken', 'bearerToken'],
			tags: ['E2EE'],
			description:
				'Replaces the device signed prekey, keeping the previous one in a backup slot so in-flight session establishments can still complete. Clients should rotate weekly.',
		}),
		async (ctx) => {
			const result = await ctx
				.get('e2eeService')
				.rotateSignedPrekey(ctx.get('user').id, ctx.req.valid('param').device_id, ctx.req.valid('json'));
			if (!result) return ctx.json({error: 'Device not found'}, 404);
			return ctx.json(result);
		},
	);

	app.post(
		'/users/@me/e2ee/devices/:device_id/one-time-prekeys',
		RateLimitMiddleware(RateLimitConfigs.USER_E2EE_TOPUP_ONETIME),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', DeviceIdParam),
		Validator('json', TopUpOneTimePrekeysRequest),
		OpenAPI({
			operationId: 'top_up_e2ee_one_time_prekeys',
			summary: 'Top up the one-time prekey pool',
			responseSchema: z.object({added: z.number().int(), total_unclaimed: z.number().int()}),
			statusCode: 200,
			security: ['sessionToken', 'bearerToken'],
			tags: ['E2EE'],
			description:
				'Uploads additional one-time prekeys for the device. Clients should call this whenever the unclaimed count drops below a threshold (typically when the count returned in list_e2ee_devices falls under ~10).',
		}),
		async (ctx) => {
			const result = await ctx
				.get('e2eeService')
				.topUpOneTimePrekeys(ctx.get('user').id, ctx.req.valid('param').device_id, ctx.req.valid('json'));
			if (!result) return ctx.json({error: 'Device not found'}, 404);
			return ctx.json(result);
		},
	);

	app.post(
		'/users/:user_id/e2ee/keys/claim',
		RateLimitMiddleware(RateLimitConfigs.USER_E2EE_CLAIM_BUNDLE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'claim_e2ee_prekey_bundles',
			summary: 'Claim prekey bundles for a recipient',
			responseSchema: E2EEPrekeyBundleListResponse,
			statusCode: 200,
			security: ['sessionToken', 'bearerToken'],
			tags: ['E2EE'],
			description:
				'Returns one prekey bundle per registered device for the target user, claiming a one-time prekey from each pool. Used by senders performing X3DH to start a new Olm session.',
		}),
		async (ctx) => {
			const bundles = await ctx
				.get('e2eeService')
				.claimPrekeyBundlesForUser(createUserID(ctx.req.valid('param').user_id));
			return ctx.json(bundles);
		},
	);
}
