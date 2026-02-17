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
	loginAccount,
	type TestAccount,
	type UserMeResponse,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import type {AuthSessionResponse} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth login and sessions', () => {
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

	it('rejects invalid login credentials', async () => {
		const account = await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email: account.email, password: 'WrongPassword123!'})
			.expect(400)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email: 'nonexistent@example.com', password: 'SomePassword123!'})
			.expect(400)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email: 'not-an-email', password: 'SomePassword123!'})
			.expect(400)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email: 'test@example.com', password: ''})
			.expect(400)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email: '', password: 'SomePassword123!'})
			.expect(400)
			.execute();
	});

	it('enforces token validity for /users/@me', async () => {
		const malformedTokens = ['', 'not-a-token', 'Bearer invalid', 'invalid.token.format', 'ey123.ey456.sig789'];
		for (const token of malformedTokens) {
			await createBuilder(harness, token).get('/users/@me').expect(401).execute();
		}

		const fakeToken = createFakeAuthToken();
		await createBuilder(harness, fakeToken).get('/users/@me').expect(401).execute();

		const account = await createTestAccount(harness);
		const meOkPayload = await createBuilder<UserMeResponse & {id?: string}>(harness, account.token)
			.get('/users/@me')
			.execute();

		expect((meOkPayload as {id: string}).id).toBe(account.userId);

		await createBuilder(harness, account.token).post('/auth/logout').expect(204).execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(401).execute();

		const fresh = await createTestAccount(harness);
		const tamperedToken = `${fresh.token.slice(0, Math.max(0, fresh.token.length - 10))}0123456789`;
		await createBuilder(harness, tamperedToken).get('/users/@me').expect(401).execute();

		await createBuilderWithoutAuth(harness).get('/users/@me').expect(401).execute();
	});

	it('supports session listing and logout flows', async () => {
		let account = await createTestAccount(harness);

		const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessions.length).toBeGreaterThan(0);
		expect(sessions[0]?.id_hash?.length).toBeGreaterThan(0);

		await createBuilder(harness, account.token)
			.post('/auth/sessions/logout')
			.body({
				session_id_hashes: [sessions[0]!.id_hash],
				password: account.password,
			})
			.expect(204)
			.execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(401).execute();

		account = await loginAccount(harness, account);

		await createBuilder(harness, account.token).post('/auth/logout').expect(204).execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(401).execute();
	});

	it('treats /auth/sessions/logout as idempotent and removes targeted sessions', async () => {
		let account: TestAccount = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/auth/sessions/logout')
			.body({
				session_id_hashes: ['nonexistent-hash-1', 'nonexistent-hash-2'],
				password: account.password,
			})
			.expect(204)
			.execute();

		const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessions.length).toBeGreaterThan(0);

		const target = sessions[0]!.id_hash;
		await createBuilder(harness, account.token)
			.post('/auth/sessions/logout')
			.body({
				session_id_hashes: [target],
				password: account.password,
			})
			.expect(204)
			.execute();

		account = await loginAccount(harness, account);

		const sessionsAfter = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessionsAfter.some((sess) => sess.id_hash === target)).toBe(false);
	});
});
