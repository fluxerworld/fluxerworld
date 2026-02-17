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

import {createGatewayClient, GatewayClient} from '@fluxer/integration/gateway/GatewayClient';
import type {TestAccount} from '@fluxer/integration/helpers/AccountHelper';
import {createTestAccount, ensureSessionStarted} from '@fluxer/integration/helpers/AccountHelper';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Gateway Connection', () => {
	let account: TestAccount;
	let gateway: GatewayClient | null = null;

	beforeEach(async () => {
		account = await createTestAccount();
		await ensureSessionStarted(account.token);
	});

	afterEach(() => {
		if (gateway) {
			gateway.close();
			gateway = null;
		}
	});

	test('should connect to gateway and receive READY', async () => {
		gateway = await createGatewayClient(account.token);

		expect(gateway.getSessionId()).toBeTruthy();
		expect(gateway.getSequence()).toBeGreaterThan(0);
	});

	test('should receive session_id in READY payload', async () => {
		gateway = await createGatewayClient(account.token);

		const sessionId = gateway.getSessionId();
		expect(sessionId).toBeTruthy();
		expect(typeof sessionId).toBe('string');
		expect(sessionId!.length).toBeGreaterThan(0);
	});

	test('should be able to resume session', async () => {
		gateway = await createGatewayClient(account.token);

		const resumeState = gateway.getResumeState();
		expect(resumeState).toBeTruthy();

		gateway.close();

		gateway = new GatewayClient(account.token);
		await gateway.resume(resumeState!);

		expect(gateway.getSessionId()).toBe(resumeState!.sessionId);
	});

	test('should handle multiple concurrent connections for different users', async () => {
		const account2 = await createTestAccount();
		await ensureSessionStarted(account2.token);

		gateway = await createGatewayClient(account.token);
		const gateway2 = await createGatewayClient(account2.token);

		try {
			expect(gateway.getSessionId()).toBeTruthy();
			expect(gateway2.getSessionId()).toBeTruthy();
			expect(gateway.getSessionId()).not.toBe(gateway2.getSessionId());
		} finally {
			gateway2.close();
		}
	});
});
