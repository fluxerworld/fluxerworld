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
	fetchSettings,
	registerUser,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('User settings defaults', () => {
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

	it('defaults incoming calls to friends-only (adult and minor)', async () => {
		const incomingCallFriendsOnly = 8;

		const adult = await createTestAccount(harness, {dateOfBirth: '2000-01-01'});
		const adultSettings = await fetchSettings(harness, adult.token);
		expect(adultSettings.response.status).toBe(200);
		expect((adultSettings.json as {incoming_call_flags: number}).incoming_call_flags).toBe(incomingCallFriendsOnly);

		const minorReg = await registerUser(harness, {
			email: createUniqueEmail(),
			username: createUniqueUsername(),
			global_name: 'Minor Settings',
			password: 'a-strong-password',
			date_of_birth: '2012-01-01',
			consent: true,
		});
		const minorSettings = await fetchSettings(harness, minorReg.token);
		expect(minorSettings.response.status).toBe(200);
		expect((minorSettings.json as {incoming_call_flags: number}).incoming_call_flags).toBe(incomingCallFriendsOnly);
	});
});
