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

import {createAuthHarness, createTestAccount, type TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {AuthSessionResponse} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth sudo password verification', () => {
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

	it('logs out session with correct password and returns sudo token', async () => {
		const account = await createTestAccount(harness);

		const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessions.length).toBeGreaterThan(0);

		await createBuilder(harness, account.token)
			.post('/auth/sessions/logout')
			.body({
				session_id_hashes: [sessions[0]!.id_hash],
				password: account.password,
			})
			.expect(204)
			.execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(401).execute();
	});

	it('rejects logout with wrong password and preserves token', async () => {
		const account: TestAccount = await createTestAccount(harness);

		const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessions.length).toBeGreaterThan(0);

		await createBuilder(harness, account.token)
			.post('/auth/sessions/logout')
			.body({
				session_id_hashes: [sessions[0]!.id_hash],
				password: 'wrong-password',
			})
			.expect(400)
			.execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(200).execute();
	});

	it('rejects logout without password with 403', async () => {
		const account = await createTestAccount(harness);

		const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
			.get('/auth/sessions')
			.execute();

		expect(sessions.length).toBeGreaterThan(0);

		await createBuilder(harness, account.token)
			.post('/auth/sessions/logout')
			.body({
				session_id_hashes: [sessions[0]!.id_hash],
			})
			.expect(403)
			.execute();
	});
});
