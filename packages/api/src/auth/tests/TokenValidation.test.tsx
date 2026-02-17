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

import {
	createAuthHarness,
	createFakeAuthToken,
	createTestAccount,
	type UserMeResponse,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth token validation', () => {
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

	it('malformed token returns unauthorized', async () => {
		const malformedTokens = ['', 'not-a-token', 'Bearer invalid', 'invalid.token.format', 'ey123.ey456.sig789'];

		for (const token of malformedTokens) {
			await createBuilder(harness, token).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
		}
	});

	it('non-existent token returns unauthorized', async () => {
		const fakeToken = createFakeAuthToken();

		await createBuilder(harness, fakeToken).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
	});

	it('revoked token returns unauthorized', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token).get('/users/@me').expect(HTTP_STATUS.OK).execute();

		await createBuilder(harness, account.token).post('/auth/logout').expect(HTTP_STATUS.NO_CONTENT).execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
	});

	it('valid token allows access', async () => {
		const account = await createTestAccount(harness);

		const user = await createBuilder<UserMeResponse>(harness, account.token).get('/users/@me').execute();

		expect(user.id).toBe(account.userId);
	});

	it('token with wrong signature returns unauthorized', async () => {
		const account = await createTestAccount(harness);

		const tamperedToken = `${account.token.slice(0, Math.max(0, account.token.length - 10))}0123456789`;

		await createBuilder(harness, tamperedToken).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
	});

	it('missing authorization header returns unauthorized', async () => {
		await createBuilderWithoutAuth(harness).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
	});
});
