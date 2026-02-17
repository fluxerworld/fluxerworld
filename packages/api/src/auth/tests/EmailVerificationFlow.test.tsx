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
	clearTestEmails,
	createAuthHarness,
	createTestAccount,
	findLastTestEmail,
	listTestEmails,
	loginAccount,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Email verification flow', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createAuthHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		await clearTestEmails(harness);
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('allows resending verification email and verifying email', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token).post('/auth/verify/resend').body({}).expect(204).execute();

		const emails = await listTestEmails(harness, {recipient: account.email});
		const verificationEmail = findLastTestEmail(emails, 'email_verification');
		expect(verificationEmail?.metadata?.token).toBeDefined();

		const token = verificationEmail!.metadata!.token!;
		await createBuilderWithoutAuth(harness).post('/auth/verify').body({token}).expect(204).execute();

		const login = await loginAccount(harness, account);
		expect(login.token).toBeDefined();
	});
});
