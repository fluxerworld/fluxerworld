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
	createUniqueEmail,
	createUniqueUsername,
	fetchMe,
	type LoginSuccessResponse,
	registerUser,
	titleCaseEmail,
	type UserMeResponse,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth registration', () => {
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

	it('returns token and user_id', async () => {
		const email = createUniqueEmail('register');
		const reg = await registerUser(harness, {
			email,
			username: createUniqueUsername('register'),
			global_name: 'Register User',
			password: 'a-strong-password',
			date_of_birth: '2000-01-01',
			consent: true,
		});

		expect(reg.token.length).toBeGreaterThan(0);
		expect(reg.user_id.length).toBeGreaterThan(0);
	});

	it('allows emoji global name', async () => {
		const globalName = '🌻 Sunflower';
		const reg = await registerUser(harness, {
			email: createUniqueEmail('global-name-emoji'),
			username: createUniqueUsername('globalnameemoji'),
			global_name: globalName,
			password: 'a-strong-password',
			date_of_birth: '2000-01-01',
			consent: true,
		});

		const me = (await fetchMe(harness, reg.token)).json as UserMeResponse;
		expect(me.global_name).toBe(globalName);
	});

	it('derives username from display name when username is omitted', async () => {
		const reg = await registerUser(harness, {
			email: createUniqueEmail('derived-username'),
			password: 'a-strong-password',
			global_name: 'Magic Tester',
			date_of_birth: '2000-01-01',
			consent: true,
		});

		const me = (await fetchMe(harness, reg.token)).json as UserMeResponse;
		expect(me.username).toBe('Magic_Tester');
	});

	it('rejects invalid registration payloads', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/auth/register')
			.body({
				email: 'not-an-email',
				username: 'itest',
				global_name: 'Test User',
				password: 'a-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(400)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/register')
			.body({
				email: createUniqueEmail('weak-password'),
				username: 'itest',
				global_name: 'Test User',
				password: 'weak',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(400)
			.execute();

		await registerUser(harness, {
			email: 'integration-duplicate-email@example.com',
			username: createUniqueUsername('firstuser'),
			global_name: 'Test User',
			password: 'a-strong-password',
			date_of_birth: '2000-01-01',
			consent: true,
		});

		const duplicateJson = await createBuilderWithoutAuth<{
			code: string;
			errors: Array<{path: string; message: string}>;
		}>(harness)
			.post('/auth/register')
			.body({
				email: 'integration-duplicate-email@example.com',
				username: createUniqueUsername('seconduser'),
				global_name: 'Test User',
				password: 'a-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(400)
			.execute();

		expect(duplicateJson.code).toBe('INVALID_FORM_BODY');
		const emailError = duplicateJson.errors.find((e) => e.path === 'email');
		expect(emailError?.message).toBe('Email already in use');

		const missingFieldsCases: Array<{name: string; body: Record<string, unknown>}> = [
			{
				name: 'missing email',
				body: {
					email: '',
					username: 'itest',
					global_name: 'Test User',
					password: 'a-strong-password',
					date_of_birth: '2000-01-01',
					consent: true,
				},
			},
			{
				name: 'missing username',
				body: {
					email: 'integration-missing-username@example.com',
					username: '',
					global_name: 'Test User',
					password: 'a-strong-password',
					date_of_birth: '2000-01-01',
					consent: true,
				},
			},
			{
				name: 'missing password',
				body: {
					email: 'integration-missing-password@example.com',
					username: 'itest',
					global_name: 'Test User',
					password: '',
					date_of_birth: '2000-01-01',
					consent: true,
				},
			},
			{
				name: 'missing date of birth',
				body: {
					email: 'integration-missing-dob@example.com',
					username: 'itest',
					global_name: 'Test User',
					password: 'a-strong-password',
					date_of_birth: '',
					consent: true,
				},
			},
		];

		for (const testCase of missingFieldsCases) {
			await createBuilderWithoutAuth(harness).post('/auth/register').body(testCase.body).expect(400).execute();
		}
	});

	it('allows login after registration', async () => {
		const email = createUniqueEmail('login');
		const password = 'a-strong-password';

		const reg = await registerUser(harness, {
			email,
			username: createUniqueUsername('loginuser'),
			global_name: 'Login User',
			password,
			date_of_birth: '2000-01-01',
			consent: true,
		});

		const login = await createBuilderWithoutAuth<LoginSuccessResponse>(harness)
			.post('/auth/login')
			.body({email, password})
			.execute();

		expect('mfa' in login).toBe(false);
		expect(login.token.length).toBeGreaterThan(0);
		expect(login.user_id).toBe(reg.user_id);
	});

	it('treats email as case-insensitive across auth flows', async () => {
		const baseEmail = 'Integration-Test-Case-Email@Example.COM';
		const password = 'a-strong-password';

		await registerUser(harness, {
			email: baseEmail,
			username: createUniqueUsername('caseuser'),
			global_name: 'Test User',
			password,
			date_of_birth: '2000-01-01',
			consent: true,
		});

		const loginEmails = [baseEmail.toLowerCase(), baseEmail.toUpperCase(), titleCaseEmail(baseEmail)];
		for (const email of loginEmails) {
			const login = await createBuilderWithoutAuth<LoginSuccessResponse>(harness)
				.post('/auth/login')
				.body({email, password})
				.execute();

			expect(login.token.length).toBeGreaterThan(0);
		}

		const duplicateJson = await createBuilderWithoutAuth<{
			code: string;
			errors: Array<{path: string; message: string}>;
		}>(harness)
			.post('/auth/register')
			.body({
				email: baseEmail.toUpperCase(),
				username: createUniqueUsername('caseuser2'),
				global_name: 'Test User',
				password: 'another-strong-password',
				date_of_birth: '2000-01-01',
				consent: true,
			})
			.expect(400)
			.execute();

		expect(duplicateJson.code).toBe('INVALID_FORM_BODY');
		const emailError = duplicateJson.errors.find((e) => e.path === 'email');
		expect(emailError?.message).toBe('Email already in use');

		await createBuilderWithoutAuth(harness)
			.post('/auth/forgot')
			.body({email: baseEmail.toUpperCase()})
			.expect(204)
			.execute();

		const caseEmailUser = await registerUser(harness, {
			email: 'integration-case-store-email@example.com',
			username: createUniqueUsername('caseemailstored'),
			global_name: 'Stored Email',
			password: 'a-strong-password',
			date_of_birth: '2000-01-01',
			consent: true,
		});
		const me = (await fetchMe(harness, caseEmailUser.token)).json as UserMeResponse;
		expect(me.email).toBe('integration-case-store-email@example.com');
	});
});
