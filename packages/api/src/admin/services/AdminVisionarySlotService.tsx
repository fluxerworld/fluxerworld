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

import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import {createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {VisionarySlotRepository} from '@fluxer/api/src/user/repositories/VisionarySlotRepository';

interface AdminVisionarySlotServiceDeps {
	repository: VisionarySlotRepository;
	auditService: AdminAuditService;
}

export class AdminVisionarySlotService {
	constructor(private readonly deps: AdminVisionarySlotServiceDeps) {}

	async expandSlots(data: {count: number}, adminUserId: UserID, auditLogReason: string | null): Promise<void> {
		await this.deps.repository.expandVisionarySlots(data.count);

		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'visionary_slot',
			targetId: BigInt(0),
			action: 'expand_visionary_slots',
			auditLogReason,
			metadata: new Map([['count', data.count.toString()]]),
		});
	}

	async shrinkSlots(data: {targetCount: number}, adminUserId: UserID, auditLogReason: string | null): Promise<void> {
		const existingSlots = await this.deps.repository.listVisionarySlots();
		await this.deps.repository.shrinkVisionarySlots(data.targetCount);

		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'visionary_slot',
			targetId: BigInt(0),
			action: 'shrink_visionary_slots',
			auditLogReason,
			metadata: new Map([
				['previous_total_count', existingSlots.length.toString()],
				['target_count', data.targetCount.toString()],
			]),
		});
	}

	async setSlotReservation(
		data: {slotIndex: number; userId: UserID | null},
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<void> {
		const existing = await this.deps.repository.getVisionarySlot(data.slotIndex);
		const previousUserId = existing?.userId ?? null;

		if (previousUserId === null && data.userId === null) {
			return;
		}
		if (previousUserId !== null && data.userId !== null && previousUserId === data.userId) {
			return;
		}

		if (data.userId === null) {
			const sentinelUserId = createUserID(BigInt(-1));
			await this.deps.repository.unreserveVisionarySlot(data.slotIndex, sentinelUserId);
		} else {
			await this.deps.repository.reserveVisionarySlot(data.slotIndex, data.userId);
		}

		let action: string;
		if (data.userId === null) {
			action = 'unreserve_visionary_slot';
		} else if (previousUserId === null) {
			action = 'reserve_visionary_slot';
		} else {
			action = 'reassign_visionary_slot';
		}

		const metadata = new Map<string, string>([
			['slot_index', data.slotIndex.toString()],
			['user_id', data.userId ? data.userId.toString() : 'null'],
		]);
		if (previousUserId !== null) {
			metadata.set('previous_user_id', previousUserId.toString());
		}

		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'visionary_slot',
			targetId: BigInt(data.slotIndex),
			action,
			auditLogReason,
			metadata,
		});
	}

	async swapSlots(
		data: {slotIndexA: number; slotIndexB: number},
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<void> {
		const {userIdA, userIdB} = await this.deps.repository.swapVisionarySlotReservations(
			data.slotIndexA,
			data.slotIndexB,
		);

		if (userIdA === userIdB) {
			return;
		}

		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'visionary_slot',
			targetId: BigInt(0),
			action: 'swap_visionary_slots',
			auditLogReason,
			metadata: new Map([
				['slot_index_a', data.slotIndexA.toString()],
				['slot_index_b', data.slotIndexB.toString()],
				['user_id_a_before', userIdA ? userIdA.toString() : 'null'],
				['user_id_b_before', userIdB ? userIdB.toString() : 'null'],
			]),
		});
	}
}
