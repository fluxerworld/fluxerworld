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
	createTestAccount,
	createUniqueEmail,
	createUniqueUsername,
	registerUser,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {Config} from '@fluxer/api/src/Config';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {TEST_CREDENTIALS, TEST_USER_DATA} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {grantPremium, updateUserProfile} from '@fluxer/api/src/user/tests/UserTestUtils';
import {NON_SELF_HOSTED_RESERVED_DISCRIMINATORS} from '@fluxer/constants/src/DiscriminatorConstants';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import type {UserPrivateResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

describe('User reserved discriminator roll', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		vi.restoreAllMocks();
	});

	afterAll(async () => {
		vi.restoreAllMocks();
		await harness?.shutdown();
	});

	it('does not randomly assign reserved discriminators when not self hosted', async () => {
		expect(Config.instance.selfHosted).toBe(false);
		expect(NON_SELF_HOSTED_RESERVED_DISCRIMINATORS.has(1)).toBe(true);

		vi.spyOn(Math, 'random').mockReturnValue(0);

		const registration = await registerUser(harness, {
			email: createUniqueEmail('reserved-discriminator-roll'),
			username: createUniqueUsername('reserved_roll'),
			global_name: TEST_USER_DATA.DEFAULT_GLOBAL_NAME,
			password: TEST_CREDENTIALS.STRONG_PASSWORD,
			date_of_birth: TEST_USER_DATA.DEFAULT_DATE_OF_BIRTH,
			consent: true,
		});

		const me = await createBuilder<UserPrivateResponse>(harness, registration.token).get('/users/@me').execute();
		const discriminator = Number.parseInt(me.discriminator, 10);

		expect(discriminator).not.toBe(1);
		expect(NON_SELF_HOSTED_RESERVED_DISCRIMINATORS.has(discriminator)).toBe(false);
	});

	it('still allows premium users to set reserved discriminators', async () => {
		expect(Config.instance.selfHosted).toBe(false);
		expect(NON_SELF_HOSTED_RESERVED_DISCRIMINATORS.has(67)).toBe(true);

		const account = await createTestAccount(harness);
		await grantPremium(harness, account.userId, UserPremiumTypes.SUBSCRIPTION);

		const updated = await updateUserProfile(harness, account.token, {
			discriminator: '0067',
			password: account.password,
		});

		expect(updated.json.discriminator).toBe('0067');
	});

	it('exposes the premium trait for active premium users', async () => {
		const account = await createTestAccount(harness);
		await grantPremium(harness, account.userId, UserPremiumTypes.SUBSCRIPTION);

		const me = await createBuilder<UserPrivateResponse>(harness, account.token).get('/users/@me').execute();
		expect(me.premium_type).toBe(UserPremiumTypes.SUBSCRIPTION);
		expect(me.traits).toContain('premium');
	});

	it('blocks subscription users from selecting #0000', async () => {
		const account = await createTestAccount(harness);
		if (!account.username) {
			throw new Error('Expected test account username');
		}
		await grantPremium(harness, account.userId, UserPremiumTypes.SUBSCRIPTION);

		const {response, text} = await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body({
				username: account.username,
				discriminator: '0000',
				password: account.password,
			})
			.executeRaw();

		expect(response.status).toBe(400);
		expect(text).toContain(ValidationErrorCodes.VISIONARY_REQUIRED_FOR_DISCRIMINATOR);
	});

	it('blocks subscription users from selecting #0000 with discriminator-only updates', async () => {
		const account = await createTestAccount(harness);
		await grantPremium(harness, account.userId, UserPremiumTypes.SUBSCRIPTION);

		const {response, text} = await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body({
				discriminator: '0000',
				password: account.password,
			})
			.executeRaw();

		expect(response.status).toBe(400);
		expect(text).toContain(ValidationErrorCodes.VISIONARY_REQUIRED_FOR_DISCRIMINATOR);
	});

	it('allows visionary users to select #0000', async () => {
		const account = await createTestAccount(harness);
		if (!account.username) {
			throw new Error('Expected test account username');
		}
		await grantPremium(harness, account.userId, UserPremiumTypes.LIFETIME);

		const updated = await updateUserProfile(harness, account.token, {
			username: account.username,
			discriminator: '0000',
			password: account.password,
		});

		expect(updated.json.discriminator).toBe('0000');
	});

	it('allows visionary users to select #0000 with discriminator-only updates', async () => {
		const account = await createTestAccount(harness);
		await grantPremium(harness, account.userId, UserPremiumTypes.LIFETIME);

		const updated = await updateUserProfile(harness, account.token, {
			discriminator: '0000',
			password: account.password,
		});

		expect(updated.json.discriminator).toBe('0000');
	});
});
