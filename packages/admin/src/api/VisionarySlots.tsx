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

import {ApiClient, type ApiResult} from '@fluxer/admin/src/api/Client';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {
	ListVisionarySlotsResponse,
	VisionarySlotOperationResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

type ListVisionarySlotsResponseType = z.infer<typeof ListVisionarySlotsResponse>;
type VisionarySlotOperationResponseType = z.infer<typeof VisionarySlotOperationResponse>;

export async function listVisionarySlots(
	config: Config,
	session: Session,
): Promise<ApiResult<ListVisionarySlotsResponseType>> {
	const client = new ApiClient(config, session);
	return await client.get<ListVisionarySlotsResponseType>('/admin/visionary-slots');
}

export async function expandVisionarySlots(
	config: Config,
	session: Session,
	count: number,
): Promise<ApiResult<VisionarySlotOperationResponseType>> {
	const client = new ApiClient(config, session);
	return await client.post<VisionarySlotOperationResponseType>('/admin/visionary-slots/expand', {count});
}

export async function shrinkVisionarySlots(
	config: Config,
	session: Session,
	targetCount: number,
): Promise<ApiResult<VisionarySlotOperationResponseType>> {
	const client = new ApiClient(config, session);
	return await client.post<VisionarySlotOperationResponseType>('/admin/visionary-slots/shrink', {
		target_count: targetCount,
	});
}

export async function reserveVisionarySlot(
	config: Config,
	session: Session,
	slotIndex: number,
	userId: string | null,
): Promise<ApiResult<VisionarySlotOperationResponseType>> {
	const client = new ApiClient(config, session);
	return await client.post<VisionarySlotOperationResponseType>('/admin/visionary-slots/reserve', {
		slot_index: slotIndex,
		user_id: userId,
	});
}

export async function swapVisionarySlots(
	config: Config,
	session: Session,
	slotIndexA: number,
	slotIndexB: number,
): Promise<ApiResult<VisionarySlotOperationResponseType>> {
	const client = new ApiClient(config, session);
	return await client.post<VisionarySlotOperationResponseType>('/admin/visionary-slots/swap', {
		slot_index_a: slotIndexA,
		slot_index_b: slotIndexB,
	});
}
