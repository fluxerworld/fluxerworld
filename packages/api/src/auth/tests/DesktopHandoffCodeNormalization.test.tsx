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

import {createAuthHarness, createTestAccount, loginAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
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

function validateHandoffCodeFormat(code: string): boolean {
	return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

describe('Auth desktop handoff code normalization', () => {
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

	it('accepts codes without dashes and is case-insensitive', async () => {
		const account = await createTestAccount(harness);
		const login = await loginAccount(harness, account);

		const initResp = await createBuilderWithoutAuth<HandoffInitiateResponse>(harness)
			.post('/auth/handoff/initiate')
			.body(null)
			.execute();

		expect(validateHandoffCodeFormat(initResp.code)).toBe(true);

		const codeWithoutDash = initResp.code.replace(/-/g, '');
		const status1 = await createBuilderWithoutAuth<HandoffStatusResponse>(harness)
			.get(`/auth/handoff/${codeWithoutDash}/status`)
			.execute();

		expect(status1.status).toBe('pending');

		const lowercaseCode = initResp.code.toLowerCase();
		await createBuilderWithoutAuth(harness)
			.post('/auth/handoff/complete')
			.body({
				code: lowercaseCode,
				token: login.token,
				user_id: login.userId,
			})
			.expect(204)
			.execute();

		const status2 = await createBuilderWithoutAuth<HandoffStatusResponse>(harness)
			.get(`/auth/handoff/${initResp.code}/status`)
			.execute();

		expect(status2.status).toBe('completed');
		expect(status2.token).toBeTruthy();
		expect(status2.token).not.toBe(login.token);
	});
});
