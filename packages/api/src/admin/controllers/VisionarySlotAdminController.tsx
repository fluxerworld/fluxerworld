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
import {Config} from '@fluxer/api/src/Config';
import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {VisionarySlotRepository} from '@fluxer/api/src/user/repositories/VisionarySlotRepository';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {FeatureNotAvailableSelfHostedError} from '@fluxer/errors/src/domains/core/FeatureNotAvailableSelfHostedError';
import {
	ExpandVisionarySlotsRequest,
	ListVisionarySlotsResponse,
	ReserveVisionarySlotRequest,
	ShrinkVisionarySlotsRequest,
	SwapVisionarySlotsRequest,
	VisionarySlotOperationResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export function VisionarySlotAdminController(app: HonoApp) {
	app.get(
		'/admin/visionary-slots',
		RateLimitMiddleware(RateLimitConfigs.VISIONARY_SLOT_OPERATION),
		requireAdminACL(AdminACLs.VISIONARY_SLOT_VIEW),
		OpenAPI({
			operationId: 'list_visionary_slots',
			summary: 'List all visionary slots',
			description: 'Retrieve the complete list of visionary slots with their reservation status.',
			responseSchema: ListVisionarySlotsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			if (Config.instance.selfHosted) {
				throw new FeatureNotAvailableSelfHostedError();
			}

			const repository = new VisionarySlotRepository();
			const slots = await repository.listVisionarySlots();

			const reservedCount = slots.filter((slot) => slot.userId !== null).length;

			return ctx.json({
				slots: slots.map((slot) => ({
					slot_index: slot.slotIndex,
					user_id: slot.userId ? slot.userId.toString() : null,
				})),
				total_count: slots.length,
				reserved_count: reservedCount,
			});
		},
	);

	app.post(
		'/admin/visionary-slots/expand',
		RateLimitMiddleware(RateLimitConfigs.VISIONARY_SLOT_OPERATION),
		requireAdminACL(AdminACLs.VISIONARY_SLOT_EXPAND),
		Validator('json', ExpandVisionarySlotsRequest),
		OpenAPI({
			operationId: 'expand_visionary_slots',
			summary: 'Expand visionary slots',
			description: 'Create additional visionary slots. New slots are added at the next available indices.',
			responseSchema: VisionarySlotOperationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			if (Config.instance.selfHosted) {
				throw new FeatureNotAvailableSelfHostedError();
			}

			const {count} = ctx.req.valid('json');
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');

			await adminService.expandVisionarySlots({count}, adminUserId, auditLogReason);

			return ctx.json({success: true});
		},
	);

	app.post(
		'/admin/visionary-slots/shrink',
		RateLimitMiddleware(RateLimitConfigs.VISIONARY_SLOT_OPERATION),
		requireAdminACL(AdminACLs.VISIONARY_SLOT_SHRINK),
		Validator('json', ShrinkVisionarySlotsRequest),
		OpenAPI({
			operationId: 'shrink_visionary_slots',
			summary: 'Shrink visionary slots',
			description:
				'Reduce the total number of visionary slots. Only unreserved slots from the highest indices can be removed. Fails if reserved slots would be deleted.',
			responseSchema: VisionarySlotOperationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			if (Config.instance.selfHosted) {
				throw new FeatureNotAvailableSelfHostedError();
			}

			const {target_count} = ctx.req.valid('json');
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');

			await adminService.shrinkVisionarySlots({targetCount: target_count}, adminUserId, auditLogReason);

			return ctx.json({success: true});
		},
	);

	app.post(
		'/admin/visionary-slots/reserve',
		RateLimitMiddleware(RateLimitConfigs.VISIONARY_SLOT_OPERATION),
		requireAdminACL(AdminACLs.VISIONARY_SLOT_RESERVE),
		Validator('json', ReserveVisionarySlotRequest),
		OpenAPI({
			operationId: 'reserve_visionary_slot',
			summary: 'Reserve or unreserve a visionary slot',
			description:
				'Reserve a specific slot index for a user ID, or unreserve it by setting user_id to null. Special value -1 is also valid for user_id.',
			responseSchema: VisionarySlotOperationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			if (Config.instance.selfHosted) {
				throw new FeatureNotAvailableSelfHostedError();
			}

			const {slot_index, user_id} = ctx.req.valid('json');
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');

			if (user_id === null) {
				await adminService.setVisionarySlotReservation(
					{slotIndex: slot_index, userId: null},
					adminUserId,
					auditLogReason,
				);
			} else {
				const userId = createUserID(BigInt(user_id));
				await adminService.setVisionarySlotReservation({slotIndex: slot_index, userId}, adminUserId, auditLogReason);
			}

			return ctx.json({success: true});
		},
	);

	app.post(
		'/admin/visionary-slots/swap',
		RateLimitMiddleware(RateLimitConfigs.VISIONARY_SLOT_OPERATION),
		requireAdminACL(AdminACLs.VISIONARY_SLOT_SWAP),
		Validator('json', SwapVisionarySlotsRequest),
		OpenAPI({
			operationId: 'swap_visionary_slots',
			summary: 'Swap visionary slot reservations',
			description: 'Swap the reserved user IDs between two slot indices.',
			responseSchema: VisionarySlotOperationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			if (Config.instance.selfHosted) {
				throw new FeatureNotAvailableSelfHostedError();
			}

			const {slot_index_a, slot_index_b} = ctx.req.valid('json');
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');

			await adminService.swapVisionarySlots(
				{slotIndexA: slot_index_a, slotIndexB: slot_index_b},
				adminUserId,
				auditLogReason,
			);

			return ctx.json({success: true});
		},
	);
}
