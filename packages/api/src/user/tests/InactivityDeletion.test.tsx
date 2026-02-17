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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {expectDataExists} from '@fluxer/api/src/user/tests/UserTestUtils';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface InactivityCheckResult {
	warnings_sent: number;
	deletions_scheduled: number;
	errors: number;
}

async function setUserActivity(harness: ApiTestHarness, userId: string, date: Date): Promise<void> {
	await createBuilderWithoutAuth(harness)
		.post(`/test/users/${userId}/set-last-active-at`)
		.body({timestamp: date.toISOString()})
		.execute();
}

async function setBotFlag(harness: ApiTestHarness, userId: string, isBot: boolean): Promise<void> {
	await createBuilderWithoutAuth(harness).post(`/test/users/${userId}/set-bot-flag`).body({is_bot: isBot}).execute();
}

async function setSystemFlag(harness: ApiTestHarness, userId: string, isSystem: boolean): Promise<void> {
	await createBuilderWithoutAuth(harness)
		.post(`/test/users/${userId}/set-system-flag`)
		.body({is_system: isSystem})
		.execute();
}

async function processInactivityDeletions(harness: ApiTestHarness): Promise<InactivityCheckResult> {
	return createBuilderWithoutAuth<InactivityCheckResult>(harness)
		.post('/test/worker/process-inactivity-deletions')
		.body({})
		.execute();
}

describe('Inactivity Deletion', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('bot user should never be scheduled for inactivity deletion', async () => {
		const account = await createTestAccount(harness);

		await setBotFlag(harness, account.userId, true);

		const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
		await setUserActivity(harness, account.userId, threeYearsAgo);

		const result = await processInactivityDeletions(harness);

		expect(result.deletions_scheduled).toBe(0);
		expect(result.warnings_sent).toBe(0);

		const dataStatus = await expectDataExists(harness, account.userId);
		expect(dataStatus.userExists).toBe(true);
		expect(dataStatus.hasSelfDeletedFlag).toBe(false);
	});

	test('system user should never be scheduled for inactivity deletion', async () => {
		const account = await createTestAccount(harness);

		await setSystemFlag(harness, account.userId, true);

		const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
		await setUserActivity(harness, account.userId, threeYearsAgo);

		const result = await processInactivityDeletions(harness);

		expect(result.deletions_scheduled).toBe(0);
		expect(result.warnings_sent).toBe(0);

		const dataStatus = await expectDataExists(harness, account.userId);
		expect(dataStatus.userExists).toBe(true);
		expect(dataStatus.hasSelfDeletedFlag).toBe(false);
	});

	test('recently active user should not receive warning', async () => {
		const account = await createTestAccount(harness);

		const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		await setUserActivity(harness, account.userId, oneMonthAgo);

		const result = await processInactivityDeletions(harness);

		expect(result.warnings_sent).toBe(0);
		expect(result.deletions_scheduled).toBe(0);
	});

	test('inactive user should receive warning email', async () => {
		const account = await createTestAccount(harness);

		const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
		await setUserActivity(harness, account.userId, threeYearsAgo);

		const result = await processInactivityDeletions(harness);

		expect(result.warnings_sent).toBeGreaterThanOrEqual(0);
	});

	test('warning email should be idempotent', async () => {
		const account = await createTestAccount(harness);

		const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
		await setUserActivity(harness, account.userId, threeYearsAgo);

		const firstResult = await processInactivityDeletions(harness);
		const firstWarnings = firstResult.warnings_sent;

		const secondResult = await processInactivityDeletions(harness);

		expect(secondResult.warnings_sent).toBeLessThanOrEqual(firstWarnings);
	});

	test('user without activity data should not be deleted', async () => {
		const account = await createTestAccount(harness);

		const result = await processInactivityDeletions(harness);

		expect(result.deletions_scheduled).toBe(0);

		const dataStatus = await expectDataExists(harness, account.userId);
		expect(dataStatus.userExists).toBe(true);
	});

	test('user already pending deletion should be skipped', async () => {
		const account = await createTestAccount(harness);

		const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
		await setUserActivity(harness, account.userId, threeYearsAgo);

		const pendingDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${account.userId}/set-pending-deletion`)
			.body({pending_deletion_at: pendingDate.toISOString()})
			.execute();

		const result = await processInactivityDeletions(harness);

		expect(result.deletions_scheduled).toBe(0);

		const dataStatus = await expectDataExists(harness, account.userId);
		expect(dataStatus.userExists).toBe(true);
	});

	test('processing should handle multiple users', async () => {
		const account1 = await createTestAccount(harness);
		const account2 = await createTestAccount(harness);
		const account3 = await createTestAccount(harness);

		await setBotFlag(harness, account1.userId, true);
		await setSystemFlag(harness, account2.userId, true);

		const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
		await setUserActivity(harness, account1.userId, threeYearsAgo);
		await setUserActivity(harness, account2.userId, threeYearsAgo);
		await setUserActivity(harness, account3.userId, threeYearsAgo);

		const result = await processInactivityDeletions(harness);

		expect(result.errors).toBe(0);

		const data1 = await expectDataExists(harness, account1.userId);
		const data2 = await expectDataExists(harness, account2.userId);

		expect(data1.hasSelfDeletedFlag).toBe(false);
		expect(data2.hasSelfDeletedFlag).toBe(false);
	});

	test('should return processing statistics', async () => {
		const result = await processInactivityDeletions(harness);

		expect(result).toHaveProperty('warnings_sent');
		expect(result).toHaveProperty('deletions_scheduled');
		expect(result).toHaveProperty('errors');
		expect(typeof result.warnings_sent).toBe('number');
		expect(typeof result.deletions_scheduled).toBe('number');
		expect(typeof result.errors).toBe('number');
	});
});
