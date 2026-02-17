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
	type TestAccount,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface BouncedEmailRequestNewResponse {
	ticket: string;
	new_email: string;
	new_code_expires_at: string;
	resend_available_at: string | null;
}

interface UserPrivateResponse {
	email: string | null;
	verified: boolean;
	email_bounced?: boolean;
	required_actions: Array<string> | null;
}

async function markEmailAsBounced(harness: ApiTestHarness, account: TestAccount): Promise<void> {
	await createBuilderWithoutAuth(harness)
		.post(`/test/users/${account.userId}/security-flags`)
		.body({
			suspicious_activity_flag_names: ['REQUIRE_REVERIFIED_EMAIL'],
			email_bounced: true,
			email_verified: false,
		})
		.expect(200)
		.execute();
}

describe('Bounced email recovery flow', () => {
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

	it('allows bounced users to replace email without original-email verification', async () => {
		const account = await createTestAccount(harness);
		await markEmailAsBounced(harness, account);

		await createBuilder(harness, account.token).get('/users/@me').expect(403).execute();
		await createBuilder(harness, account.token).post('/users/@me/email-change/start').body({}).expect(403).execute();

		const replacementEmail = `replacement-${Date.now()}@example.com`;
		const requestNewResponse = await createBuilder<BouncedEmailRequestNewResponse>(harness, account.token)
			.post('/users/@me/email-change/bounced/request-new')
			.body({new_email: replacementEmail})
			.execute();

		expect(requestNewResponse.new_email).toBe(replacementEmail);

		const originalEmailMessages = await listTestEmails(harness, {recipient: account.email});
		expect(findLastTestEmail(originalEmailMessages, 'email_change_original')).toBeNull();

		const replacementEmailMessages = await listTestEmails(harness, {recipient: replacementEmail});
		const replacementVerificationEmail = findLastTestEmail(replacementEmailMessages, 'email_change_new');
		expect(replacementVerificationEmail?.metadata?.code).toBeDefined();

		const updatedUser = await createBuilder<UserPrivateResponse>(harness, account.token)
			.post('/users/@me/email-change/bounced/verify-new')
			.body({
				ticket: requestNewResponse.ticket,
				code: replacementVerificationEmail!.metadata!.code!,
			})
			.execute();

		expect(updatedUser.email).toBe(replacementEmail);
		expect(updatedUser.verified).toBe(true);
		expect(updatedUser.email_bounced).toBe(false);
		expect(updatedUser.required_actions).toBeNull();

		const me = await createBuilder<UserPrivateResponse>(harness, account.token).get('/users/@me').execute();
		expect(me.email).toBe(replacementEmail);
		expect(me.email_bounced).toBe(false);
	});

	it('rejects bounced-email recovery for accounts that are not marked as bounced', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/users/@me/email-change/bounced/request-new')
			.body({new_email: `replacement-${Date.now()}@example.com`})
			.expect(403, 'ACCESS_DENIED')
			.execute();
	});
});
