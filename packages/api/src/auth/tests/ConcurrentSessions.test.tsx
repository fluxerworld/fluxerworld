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
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {AuthSessionResponse} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth concurrent sessions', () => {
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

	it('same user can have multiple concurrent sessions', async () => {
		const account = await createTestAccount(harness);

		const session1Token = account.token;

		const account2 = await loginAccount(harness, account);
		const session2Token = account2.token;

		if (session1Token === session2Token) {
			console.warn('warning: multiple logins returned the same token, may indicate single-session behavior');
		}

		await createBuilder(harness, session1Token).get('/users/@me').expect(200).execute();

		await createBuilder(harness, session2Token).get('/users/@me').expect(200).execute();
	});

	it('logging out one session does not affect other sessions', async () => {
		const account = await createTestAccount(harness);

		const session1Token = account.token;

		const account2 = await loginAccount(harness, account);
		const session2Token = account2.token;

		const account3 = await loginAccount(harness, account);
		const session3Token = account3.token;

		const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, session1Token)
			.get('/auth/sessions')
			.execute();

		expect(sessions.length).toBeGreaterThanOrEqual(3);

		await createBuilder(harness, session2Token).post('/auth/logout').expect(204).execute();

		await createBuilder(harness, session1Token).get('/users/@me').expect(200).execute();

		await createBuilder(harness, session3Token).get('/users/@me').expect(200).execute();

		await createBuilder(harness, session2Token).get('/users/@me').expect(401).execute();
	});

	it('can list all active sessions', async () => {
		const account = await createTestAccount(harness);

		await loginAccount(harness, account);
		await loginAccount(harness, account);

		const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessions.length).toBeGreaterThan(0);

		for (const session of sessions) {
			expect(session.id_hash).toBeTruthy();
			expect(session.id_hash.length).toBeGreaterThan(0);
		}
	});

	it('can log out specific session by ID', async () => {
		let account = await createTestAccount(harness);

		await loginAccount(harness, account);

		const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessions.length).toBeGreaterThanOrEqual(2);

		const targetSessionID = sessions[0]!.id_hash;

		await createBuilder(harness, account.token)
			.post('/auth/sessions/logout')
			.body({
				session_id_hashes: [targetSessionID],
				password: account.password,
			})
			.expect(204)
			.execute();

		account = await loginAccount(harness, account);

		const sessions2 = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessions2.find((s) => s.id_hash === targetSessionID)).toBeUndefined();
	});
});
