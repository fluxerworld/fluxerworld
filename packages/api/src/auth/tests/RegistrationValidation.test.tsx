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
	createTestAccount,
	createUniqueEmail,
	createUniqueUsername,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface ValidationErrorResponse {
	code: string;
	message: string;
	errors?: Array<{path: string; code: string; message: string}>;
}

describe('Registration validation', () => {
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

	it('rejects invalid email format', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/auth/register')
			.body({
				email: 'not-an-email',
				username: createUniqueUsername(),
				global_name: 'Test User',
				password: 'a-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(400)
			.execute();
	});

	it('rejects weak password', async () => {
		const json = await createBuilderWithoutAuth<ValidationErrorResponse>(harness)
			.post('/auth/register')
			.body({
				email: createUniqueEmail(),
				username: createUniqueUsername(),
				global_name: 'Test User',
				password: 'weak',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();

		const passwordError = json.errors?.find((e) => e.path === 'password');
		expect(passwordError?.code).toBe('PASSWORD_LENGTH_INVALID');
		expect(passwordError?.message).toBe('String length must be between 8 and 256 characters.');
	});

	it('includes bounds in username length validation message', async () => {
		const json = await createBuilderWithoutAuth<ValidationErrorResponse>(harness)
			.post('/auth/register')
			.body({
				email: createUniqueEmail(),
				username: 'a'.repeat(33),
				global_name: 'Test User',
				password: 'a-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();

		const usernameError = json.errors?.find((e) => e.path === 'username');
		expect(usernameError?.code).toBe('USERNAME_LENGTH_INVALID');
		expect(usernameError?.message).toBe('Username must be between 1 and 32 characters.');
	});

	it('rejects duplicate email', async () => {
		const account = await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post('/auth/register')
			.body({
				email: account.email,
				username: createUniqueUsername(),
				global_name: 'Test User',
				password: 'a-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('rejects missing date of birth', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/auth/register')
			.body({
				email: createUniqueEmail(),
				username: createUniqueUsername(),
				global_name: 'Test User',
				password: 'a-strong-password',
				consent: true,
			})
			.expect(400)
			.execute();
	});

	it('allows emoji in global name', async () => {
		const globalName = '🌻 Sunflower';
		const reg = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/register')
			.body({
				email: createUniqueEmail('emoji'),
				username: createUniqueUsername('emoji'),
				global_name: globalName,
				password: 'a-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.execute();

		const me = await createBuilder<{global_name: string}>(harness, reg.token).get('/users/@me').execute();

		expect(me.global_name).toBe(globalName);
	});

	it('derives username from global name when username is not provided', async () => {
		const reg = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/register')
			.body({
				email: createUniqueEmail('derived'),
				global_name: 'Magic Tester',
				password: 'a-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.execute();

		const me = await createBuilder<{username: string}>(harness, reg.token).get('/users/@me').execute();

		expect(me.username).toBe('Magic_Tester');
	});
});
