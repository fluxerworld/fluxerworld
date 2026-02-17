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
	type LoginSuccessResponse,
	listTestEmails,
	loginUser,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {generateUniquePassword, HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Password reset flow', () => {
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

	it('allows forgot and reset password flow with token reuse rejection and session invalidation', async () => {
		const account = await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post('/auth/forgot')
			.body({email: account.email})
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		const emails = await listTestEmails(harness, {recipient: account.email});
		const resetEmail = findLastTestEmail(emails, 'password_reset');
		expect(resetEmail?.metadata?.token).toBeDefined();

		const token = resetEmail!.metadata!.token!;
		const newPassword = generateUniquePassword();

		const resetResp = await createBuilderWithoutAuth<LoginSuccessResponse>(harness)
			.post('/auth/reset')
			.body({token, password: newPassword})
			.execute();
		expect(resetResp.token.length).toBeGreaterThan(0);

		const login = await loginUser(harness, {email: account.email, password: newPassword});
		if ('mfa' in login && login.mfa) {
			throw new Error('Expected non-MFA login');
		}
		const nonMfaLogin = login as {user_id: string; token: string};
		expect(nonMfaLogin.token.length).toBeGreaterThan(0);

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email: account.email, password: account.password})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();

		const anotherPassword = generateUniquePassword();
		await createBuilderWithoutAuth(harness)
			.post('/auth/reset')
			.body({token, password: anotherPassword})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects invalid reset token', async () => {
		await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post('/auth/reset')
			.body({token: 'invalid-reset-token', password: generateUniquePassword()})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
