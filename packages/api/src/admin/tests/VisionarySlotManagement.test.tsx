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

import {createTestAccount, setUserACLs, type TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {beforeEach, describe, expect, test} from 'vitest';

interface VisionarySlot {
	slot_index: number;
	user_id: string | null;
}

interface ListVisionarySlotsResponse {
	slots: Array<VisionarySlot>;
	total_count: number;
	reserved_count: number;
}

interface VisionarySlotOperationResponse {
	success: true;
}

async function setAdminVisionarySlotAcls(harness: ApiTestHarness, admin: TestAccount): Promise<TestAccount> {
	return await setUserACLs(harness, admin, [
		'admin:authenticate',
		'audit_log:view',
		'visionary_slot:view',
		'visionary_slot:expand',
		'visionary_slot:shrink',
		'visionary_slot:reserve',
		'visionary_slot:swap',
	]);
}

async function listVisionarySlots(harness: ApiTestHarness, adminToken: string): Promise<ListVisionarySlotsResponse> {
	return await createBuilder<ListVisionarySlotsResponse>(harness, `Bearer ${adminToken}`)
		.get('/admin/visionary-slots')
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function expandVisionarySlots(
	harness: ApiTestHarness,
	adminToken: string,
	count: number,
): Promise<VisionarySlotOperationResponse> {
	return await createBuilder<VisionarySlotOperationResponse>(harness, `Bearer ${adminToken}`)
		.post('/admin/visionary-slots/expand')
		.body({count})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function shrinkVisionarySlots(
	harness: ApiTestHarness,
	adminToken: string,
	targetCount: number,
): Promise<VisionarySlotOperationResponse> {
	return await createBuilder<VisionarySlotOperationResponse>(harness, `Bearer ${adminToken}`)
		.post('/admin/visionary-slots/shrink')
		.body({target_count: targetCount})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function reserveVisionarySlot(
	harness: ApiTestHarness,
	adminToken: string,
	slotIndex: number,
	userId: string | null,
): Promise<VisionarySlotOperationResponse> {
	return await createBuilder<VisionarySlotOperationResponse>(harness, `Bearer ${adminToken}`)
		.post('/admin/visionary-slots/reserve')
		.body({slot_index: slotIndex, user_id: userId})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function swapVisionarySlots(
	harness: ApiTestHarness,
	adminToken: string,
	slotIndexA: number,
	slotIndexB: number,
): Promise<VisionarySlotOperationResponse> {
	return await createBuilder<VisionarySlotOperationResponse>(harness, `Bearer ${adminToken}`)
		.post('/admin/visionary-slots/swap')
		.body({slot_index_a: slotIndexA, slot_index_b: slotIndexB})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function listVisionarySlotAuditLogs(harness: ApiTestHarness, adminToken: string) {
	return await createBuilder<{logs: Array<{action: string}>; total: number}>(harness, `Bearer ${adminToken}`)
		.post('/admin/audit-logs')
		.body({target_type: 'visionary_slot', limit: 50, offset: 0})
		.expect(HTTP_STATUS.OK)
		.execute();
}

describe('Visionary slot management', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('lists all visionary slots', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);

		const result = await listVisionarySlots(harness, updatedAdmin.token);

		expect(result.total_count).toBeGreaterThan(0);
		expect(result.slots.length).toBe(result.total_count);
		expect(result.reserved_count).toBeGreaterThanOrEqual(0);
	});

	test('expands visionary slots', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);

		const before = await listVisionarySlots(harness, updatedAdmin.token);
		await expandVisionarySlots(harness, updatedAdmin.token, 5);
		const after = await listVisionarySlots(harness, updatedAdmin.token);

		expect(after.total_count).toBe(before.total_count + 5);
	});

	test('shrinks visionary slots to target count', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);

		await expandVisionarySlots(harness, updatedAdmin.token, 10);
		const before = await listVisionarySlots(harness, updatedAdmin.token);
		const targetCount = before.total_count - 3;

		await shrinkVisionarySlots(harness, updatedAdmin.token, targetCount);
		const after = await listVisionarySlots(harness, updatedAdmin.token);

		expect(after.total_count).toBe(targetCount);
	});

	test('allows shrinking visionary slots to 0', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);

		const before = await listVisionarySlots(harness, updatedAdmin.token);
		expect(before.total_count).toBeGreaterThan(0);

		await shrinkVisionarySlots(harness, updatedAdmin.token, 0);
		const after = await listVisionarySlots(harness, updatedAdmin.token);

		expect(after.total_count).toBe(0);
		expect(after.reserved_count).toBe(0);
	});

	test('cannot shrink below highest reserved slot', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);
		const user = await createTestAccount(harness);

		const slots = await listVisionarySlots(harness, updatedAdmin.token);
		const slotToReserve = slots.slots[slots.slots.length - 1];
		if (!slotToReserve) throw new Error('No slots available');
		if (slotToReserve.slot_index <= 1) throw new Error('Slot index is too low to shrink');

		await reserveVisionarySlot(harness, updatedAdmin.token, slotToReserve.slot_index, user.userId);

		await createBuilder(harness, `Bearer ${updatedAdmin.token}`)
			.post('/admin/visionary-slots/shrink')
			.body({target_count: slotToReserve.slot_index - 1})
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CANNOT_SHRINK_RESERVED_SLOTS)
			.execute();
	});

	test('reserves a slot for a user', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);
		const user = await createTestAccount(harness);

		const slots = await listVisionarySlots(harness, updatedAdmin.token);
		const unreservedSlot = slots.slots.find((slot) => slot.user_id === null);
		if (!unreservedSlot) throw new Error('No unreserved slots available');

		await reserveVisionarySlot(harness, updatedAdmin.token, unreservedSlot.slot_index, user.userId);
		const after = await listVisionarySlots(harness, updatedAdmin.token);
		const reserved = after.slots.find((slot) => slot.slot_index === unreservedSlot.slot_index);

		expect(reserved?.user_id).toBe(user.userId);
		expect(after.reserved_count).toBe(slots.reserved_count + 1);
	});

	test('unreserves a slot by setting user_id to null', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);
		const user = await createTestAccount(harness);

		const slots = await listVisionarySlots(harness, updatedAdmin.token);
		const unreservedSlot = slots.slots.find((slot) => slot.user_id === null);
		if (!unreservedSlot) throw new Error('No unreserved slots available');

		await reserveVisionarySlot(harness, updatedAdmin.token, unreservedSlot.slot_index, user.userId);
		await reserveVisionarySlot(harness, updatedAdmin.token, unreservedSlot.slot_index, null);
		const after = await listVisionarySlots(harness, updatedAdmin.token);
		const unreserved = after.slots.find((slot) => slot.slot_index === unreservedSlot.slot_index);

		expect(unreserved?.user_id).toBeNull();
	});

	test('accepts -1 as a valid user_id', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);

		const slots = await listVisionarySlots(harness, updatedAdmin.token);
		const unreservedSlot = slots.slots.find((slot) => slot.user_id === null);
		if (!unreservedSlot) throw new Error('No unreserved slots available');

		await reserveVisionarySlot(harness, updatedAdmin.token, unreservedSlot.slot_index, '-1');
		const after = await listVisionarySlots(harness, updatedAdmin.token);
		const reserved = after.slots.find((slot) => slot.slot_index === unreservedSlot.slot_index);

		expect(reserved?.user_id).toBe('-1');
	});

	test('swaps two reserved slots between users', async () => {
		const admin = await createTestAccount(harness);
		const updatedAdmin = await setAdminVisionarySlotAcls(harness, admin);
		const userA = await createTestAccount(harness);
		const userB = await createTestAccount(harness);

		const slots = await listVisionarySlots(harness, updatedAdmin.token);
		const unreservedSlots = slots.slots.filter((slot) => slot.user_id === null).slice(0, 2);
		const slotA = unreservedSlots[0];
		const slotB = unreservedSlots[1];
		if (!slotA || !slotB) throw new Error('Not enough unreserved slots available');

		await reserveVisionarySlot(harness, updatedAdmin.token, slotA.slot_index, userA.userId);
		await reserveVisionarySlot(harness, updatedAdmin.token, slotB.slot_index, userB.userId);

		await swapVisionarySlots(harness, updatedAdmin.token, slotA.slot_index, slotB.slot_index);

		const after = await listVisionarySlots(harness, updatedAdmin.token);
		const afterSlotA = after.slots.find((slot) => slot.slot_index === slotA.slot_index);
		const afterSlotB = after.slots.find((slot) => slot.slot_index === slotB.slot_index);

		expect(afterSlotA?.user_id).toBe(userB.userId);
		expect(afterSlotB?.user_id).toBe(userA.userId);

		const auditLogs = await listVisionarySlotAuditLogs(harness, updatedAdmin.token);
		expect(auditLogs.logs.some((log) => log.action === 'swap_visionary_slots')).toBe(true);
	});

	test('requires visionary_slot:view permission to list slots', async () => {
		const admin = await createTestAccount(harness);
		const limitedAdmin = await setUserACLs(harness, admin, ['admin:authenticate']);

		await createBuilder(harness, `Bearer ${limitedAdmin.token}`)
			.get('/admin/visionary-slots')
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_ACL)
			.execute();
	});

	test('requires visionary_slot:expand permission to expand slots', async () => {
		const admin = await createTestAccount(harness);
		const limitedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'visionary_slot:view']);

		await createBuilder(harness, `Bearer ${limitedAdmin.token}`)
			.post('/admin/visionary-slots/expand')
			.body({count: 5})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_ACL)
			.execute();
	});

	test('requires visionary_slot:shrink permission to shrink slots', async () => {
		const admin = await createTestAccount(harness);
		const limitedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'visionary_slot:view']);

		await createBuilder(harness, `Bearer ${limitedAdmin.token}`)
			.post('/admin/visionary-slots/shrink')
			.body({target_count: 50})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_ACL)
			.execute();
	});

	test('requires visionary_slot:reserve permission to reserve slots', async () => {
		const admin = await createTestAccount(harness);
		const limitedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'visionary_slot:view']);

		await createBuilder(harness, `Bearer ${limitedAdmin.token}`)
			.post('/admin/visionary-slots/reserve')
			.body({slot_index: 0, user_id: '123456789'})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_ACL)
			.execute();
	});

	test('requires visionary_slot:swap permission to swap slots', async () => {
		const admin = await createTestAccount(harness);
		const limitedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'visionary_slot:view']);

		await createBuilder(harness, `Bearer ${limitedAdmin.token}`)
			.post('/admin/visionary-slots/swap')
			.body({slot_index_a: 1, slot_index_b: 2})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_ACL)
			.execute();
	});
});
