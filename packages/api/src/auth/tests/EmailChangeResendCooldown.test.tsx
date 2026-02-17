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
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

interface EmailChangeStartResponse {
	ticket: string;
	require_original: boolean;
	original_proof?: string;
	original_code_expires_at?: string;
	resend_available_at?: string;
}

interface EmailChangeVerifyOriginalResponse {
	original_proof: string;
}

interface EmailChangeRequestNewResponse {
	ticket: string;
	new_email: string;
	new_code_expires_at: string;
	resend_available_at?: string;
}

async function startEmailChange(
	harness: ApiTestHarness,
	account: TestAccount,
	password: string,
): Promise<EmailChangeStartResponse> {
	return createBuilder<EmailChangeStartResponse>(harness, account.token)
		.post('/users/@me/email-change/start')
		.body({password})
		.execute();
}

async function verifyOriginalEmailChange(
	harness: ApiTestHarness,
	account: TestAccount,
	ticket: string,
	code: string,
	password: string,
): Promise<string> {
	const resp = await createBuilder<EmailChangeVerifyOriginalResponse>(harness, account.token)
		.post('/users/@me/email-change/verify-original')
		.body({ticket, code, password})
		.execute();
	return resp.original_proof;
}

async function requestNewEmailChange(
	harness: ApiTestHarness,
	account: TestAccount,
	ticket: string,
	newEmail: string,
	originalProof: string,
	password: string,
): Promise<EmailChangeRequestNewResponse> {
	return createBuilder<EmailChangeRequestNewResponse>(harness, account.token)
		.post('/users/@me/email-change/request-new')
		.body({
			ticket,
			new_email: newEmail,
			original_proof: originalProof,
			password,
		})
		.execute();
}

describe('Email change resend cooldown', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createAuthHarness();
	});

	beforeEach(async () => {
		vi.useFakeTimers();
		await harness.reset();
		await clearTestEmails(harness);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('enforces cooldown period for resending new email verification', async () => {
		const account = await createTestAccount(harness);

		const startResp = await startEmailChange(harness, account, account.password);

		let originalProof: string;
		if (startResp.require_original) {
			const emails = await listTestEmails(harness, {recipient: account.email});
			const originalEmail = findLastTestEmail(emails, 'email_change_original');
			expect(originalEmail?.metadata?.code).toBeDefined();

			const originalCode = originalEmail!.metadata!.code!;
			originalProof = await verifyOriginalEmailChange(
				harness,
				account,
				startResp.ticket,
				originalCode,
				account.password,
			);
		} else {
			expect(startResp.original_proof).toBeDefined();
			originalProof = startResp.original_proof!;
		}

		const newEmail = `cooldown-${Date.now()}@example.com`;
		await requestNewEmailChange(harness, account, startResp.ticket, newEmail, originalProof, account.password);

		await createBuilder(harness, account.token)
			.post('/users/@me/email-change/resend-new')
			.body({
				ticket: startResp.ticket,
			})
			.expect(429)
			.execute();

		await vi.advanceTimersByTimeAsync(31000);

		await createBuilder(harness, account.token)
			.post('/users/@me/email-change/resend-new')
			.body({
				ticket: startResp.ticket,
			})
			.expect(204)
			.execute();
	});
});
