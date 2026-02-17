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

describe('Auth desktop handoff complete single use', () => {
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

	it('prevents reuse of handoff code after completion', async () => {
		const account = await createTestAccount(harness);
		const login = await loginAccount(harness, account);

		const initResp = await createBuilderWithoutAuth<HandoffInitiateResponse>(harness)
			.post('/auth/handoff/initiate')
			.body(null)
			.execute();

		expect(initResp.code).toBeTruthy();

		await createBuilderWithoutAuth(harness)
			.post('/auth/handoff/complete')
			.body({
				code: initResp.code,
				token: login.token,
				user_id: login.userId,
			})
			.expect(204)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/handoff/complete')
			.body({
				code: initResp.code,
				token: login.token,
				user_id: login.userId,
			})
			.expect(400)
			.execute();

		const status = await createBuilderWithoutAuth<HandoffStatusResponse>(harness)
			.get(`/auth/handoff/${initResp.code}/status`)
			.execute();

		expect(status.status).toBe('completed');
		expect(status.token).toBeTruthy();
		expect(status.token).not.toBe(login.token);
	});
});
