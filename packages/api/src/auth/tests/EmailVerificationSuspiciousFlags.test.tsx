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
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {SuspiciousActivityFlags} from '@fluxer/constants/src/UserConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface SuspiciousActivityErrorResponse {
	error: string;
	data: {
		suspicious_activity_flags: number;
	};
}

describe('Email verification suspicious flags', () => {
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

	it('clears only email-related suspicious flags after verification', async () => {
		const account = await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${account.userId}/security-flags`)
			.body({
				suspicious_activity_flag_names: ['REQUIRE_VERIFIED_EMAIL', 'REQUIRE_VERIFIED_PHONE'],
			})
			.expect(200)
			.execute();

		const checkSuspiciousFlags = async (expected: number): Promise<void> => {
			const errBody = await createBuilder<SuspiciousActivityErrorResponse>(harness, account.token)
				.get('/users/@me')
				.expect(403)
				.execute();

			expect(errBody.data.suspicious_activity_flags).toBe(expected);
		};

		await checkSuspiciousFlags(
			SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL | SuspiciousActivityFlags.REQUIRE_VERIFIED_PHONE,
		);

		await createBuilder(harness, account.token).post('/auth/verify/resend').body({}).expect(204).execute();

		const emails = await listTestEmails(harness, {recipient: account.email});
		const verificationEmail = findLastTestEmail(emails, 'email_verification');
		expect(verificationEmail?.metadata?.token).toBeDefined();

		const token = verificationEmail!.metadata!.token!;
		await createBuilderWithoutAuth(harness).post('/auth/verify').body({token}).expect(204).execute();

		await checkSuspiciousFlags(SuspiciousActivityFlags.REQUIRE_VERIFIED_PHONE);
	});
});
