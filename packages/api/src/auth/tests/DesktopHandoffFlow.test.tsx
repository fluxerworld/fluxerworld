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

import {createAuthHarness, createTestAccount, fetchMe, loginAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface HandoffInitiateResponse {
	code: string;
}

interface HandoffStatusResponse {
	status: 'pending' | 'completed' | 'expired';
	token?: string;
	user_id?: string;
}

interface UserMeResponse {
	id: string;
	email: string | null;
	username: string;
	global_name: string | null;
}

function validateHandoffCodeFormat(code: string): boolean {
	return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

describe('Auth desktop handoff flow', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createAuthHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('completes full handoff flow and cancels correctly', async () => {
		const account = await createTestAccount(harness);
		const login = await loginAccount(harness, account);

		const initResp = await createBuilderWithoutAuth<HandoffInitiateResponse>(harness)
			.post('/auth/handoff/initiate')
			.body(null)
			.execute();
		expect(initResp.code).toBeTruthy();
		expect(validateHandoffCodeFormat(initResp.code)).toBe(true);

		const pending = await createBuilderWithoutAuth<HandoffStatusResponse>(harness)
			.get(`/auth/handoff/${initResp.code}/status`)
			.execute();
		expect(pending.status).toBe('pending');
		expect(pending.token).toBeUndefined();
		expect(pending.user_id).toBeUndefined();

		await createBuilderWithoutAuth(harness)
			.post('/auth/handoff/complete')
			.body({
				code: initResp.code,
				token: login.token,
				user_id: login.userId,
			})
			.expect(204)
			.execute();

		const completed = await createBuilderWithoutAuth<HandoffStatusResponse>(harness)
			.get(`/auth/handoff/${initResp.code}/status`)
			.execute();
		expect(completed.status).toBe('completed');
		expect(completed.token).toBeTruthy();
		expect(completed.token).not.toBe(login.token);
		expect(completed.user_id).toBe(login.userId);

		const originalSession = await fetchMe(harness, login.token);
		expect(originalSession.response.status).toBe(200);
		const originalUser = originalSession.json as UserMeResponse;
		expect(originalUser.id).toBe(login.userId);

		const handoffSession = await fetchMe(harness, completed.token!);
		expect(handoffSession.response.status).toBe(200);
		const handoffUser = handoffSession.json as UserMeResponse;
		expect(handoffUser.id).toBe(login.userId);

		const retrieved = await createBuilderWithoutAuth<HandoffStatusResponse>(harness)
			.get(`/auth/handoff/${initResp.code}/status`)
			.execute();
		expect(retrieved.status).toBe('expired');

		const second = await createBuilderWithoutAuth<HandoffInitiateResponse>(harness)
			.post('/auth/handoff/initiate')
			.body(null)
			.execute();

		await createBuilderWithoutAuth(harness).delete(`/auth/handoff/${second.code}`).expect(204).execute();

		const cancelled = await createBuilderWithoutAuth<HandoffStatusResponse>(harness)
			.get(`/auth/handoff/${second.code}/status`)
			.execute();
		expect(cancelled.status).toBe('expired');
	});
});
