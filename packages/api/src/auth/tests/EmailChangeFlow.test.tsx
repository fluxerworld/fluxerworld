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

interface EmailChangeVerifyNewResponse {
	email_token: string;
}

interface UserPrivateResponse {
	id: string;
	email: string;
	phone?: string | null;
	username: string;
	discriminator: string;
	global_name: string;
	bio: string;
	verified: boolean;
	mfa_enabled: boolean;
	authenticator_types: Array<number>;
	password_last_changed_at?: string;
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

async function verifyNewEmailChange(
	harness: ApiTestHarness,
	account: TestAccount,
	ticket: string,
	code: string,
	originalProof: string,
	password: string,
): Promise<string> {
	const resp = await createBuilder<EmailChangeVerifyNewResponse>(harness, account.token)
		.post('/users/@me/email-change/verify-new')
		.body({
			ticket,
			code,
			original_proof: originalProof,
			password,
		})
		.execute();

	return resp.email_token;
}

async function unclaimAccount(harness: ApiTestHarness, userId: string): Promise<void> {
	await createBuilderWithoutAuth(harness).post(`/test/users/${userId}/unclaim`).body(null).expect(200).execute();
}

describe('Email change flow', () => {
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

	it('uses ticketed dual-code flow with sudo and proof token', async () => {
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

		const newEmail = `integration-new-${Date.now()}@example.com`;
		const newReq = await requestNewEmailChange(
			harness,
			account,
			startResp.ticket,
			newEmail,
			originalProof,
			account.password,
		);
		expect(newReq.new_email).toBe(newEmail);

		const newEmails = await listTestEmails(harness, {recipient: newEmail});
		const newEmailData = findLastTestEmail(newEmails, 'email_change_new');
		expect(newEmailData?.metadata?.code).toBeDefined();

		const newCode = newEmailData!.metadata!.code!;
		const token = await verifyNewEmailChange(
			harness,
			account,
			startResp.ticket,
			newCode,
			originalProof,
			account.password,
		);

		const updated = await createBuilder<UserPrivateResponse>(harness, account.token)
			.patch('/users/@me')
			.body({
				email_token: token,
				password: account.password,
			})
			.execute();

		expect(updated.email).toBe(newEmail);
	});

	it('rejects direct email field update', async () => {
		const account = await createTestAccount(harness);

		const newEmail = `integration-direct-${Date.now()}@example.com`;
		await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body({
				email: newEmail,
				password: account.password,
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('request-new fails without original_proof', async () => {
		const account = await createTestAccount(harness);

		const startResp = await startEmailChange(harness, account, account.password);

		const newEmail = `integration-no-proof-${Date.now()}@example.com`;
		await createBuilder(harness, account.token)
			.post('/users/@me/email-change/request-new')
			.body({
				ticket: startResp.ticket,
				new_email: newEmail,
				original_proof: 'invalid-proof-token',
				password: account.password,
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('verify-new fails without original_proof', async () => {
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
			originalProof = startResp.original_proof!;
		}

		const newEmail = `integration-verify-no-proof-${Date.now()}@example.com`;
		await requestNewEmailChange(harness, account, startResp.ticket, newEmail, originalProof, account.password);

		const newEmails = await listTestEmails(harness, {recipient: newEmail});
		const newEmailData = findLastTestEmail(newEmails, 'email_change_new');
		expect(newEmailData?.metadata?.code).toBeDefined();

		const newCode = newEmailData!.metadata!.code!;

		await createBuilder(harness, account.token)
			.post('/users/@me/email-change/verify-new')
			.body({
				ticket: startResp.ticket,
				code: newCode,
				original_proof: 'invalid-proof-token',
				password: account.password,
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('returns original_proof from start when require_original is false', async () => {
		const account = await createTestAccount(harness);
		await unclaimAccount(harness, account.userId);

		const startResp = await createBuilder<EmailChangeStartResponse>(harness, account.token)
			.post('/users/@me/email-change/start')
			.body({})
			.execute();

		expect(startResp.require_original).toBe(false);
		expect(startResp.original_proof).toBeDefined();
		expect(startResp.original_proof!.length).toBeGreaterThan(0);
	});

	it('verify-original returns original_proof for verified email accounts', async () => {
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
			expect(originalProof.length).toBeGreaterThan(0);
		} else {
			expect(startResp.original_proof).toBeDefined();
			expect(startResp.original_proof!.length).toBeGreaterThan(0);
			originalProof = startResp.original_proof!;
		}

		const newEmail = `integration-verify-flow-${Date.now()}@example.com`;
		const newReq = await requestNewEmailChange(
			harness,
			account,
			startResp.ticket,
			newEmail,
			originalProof,
			account.password,
		);
		expect(newReq.new_email).toBe(newEmail);
	});
});
