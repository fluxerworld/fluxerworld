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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {fetchUserMe, updateUserProfile} from '@fluxer/api/src/user/tests/UserTestUtils';
import {beforeEach, describe, expect, test} from 'vitest';

async function runCaseUpdateTest(
	harness: ApiTestHarness,
	testFn: (params: {
		account: {userId: string; token: string; email: string; password: string};
		initialUser: {username: string; discriminator: string};
	}) => Promise<void>,
): Promise<void> {
	const account = await createTestAccount(harness);

	const {json: initialUser} = await fetchUserMe(harness, account.token);

	await testFn({
		account,
		initialUser: {
			username: initialUser.username,
			discriminator: initialUser.discriminator,
		},
	});
}

describe('User Username Case Update', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('re-sending existing username keeps discriminator', async () => {
		await runCaseUpdateTest(harness, async ({account, initialUser}) => {
			const updated = await updateUserProfile(harness, account.token, {
				username: initialUser.username,
				password: account.password,
			});
			expect(updated.json.username).toBe(initialUser.username);
			expect(updated.json.discriminator).toBe(initialUser.discriminator);
		});
	});

	test('changing username case preserves discriminator', async () => {
		await runCaseUpdateTest(harness, async ({account, initialUser}) => {
			let newUsername = initialUser.username.toUpperCase();
			if (newUsername === initialUser.username) {
				newUsername = initialUser.username.toLowerCase();
			}

			const updated = await updateUserProfile(harness, account.token, {
				username: newUsername,
				password: account.password,
			});
			expect(updated.json.username).toBe(newUsername);
			expect(updated.json.discriminator).toBe(initialUser.discriminator);
		});
	});

	test('changing username completely works', async () => {
		await runCaseUpdateTest(harness, async ({account, initialUser}) => {
			const newUsername = `diff${initialUser.username.slice(0, Math.min(initialUser.username.length, 28))}`;

			const updated = await updateUserProfile(harness, account.token, {
				username: newUsername,
				password: account.password,
			});
			expect(updated.json.username).toBe(newUsername);
		});
	});

	test('no-op username and discriminator stays unchanged', async () => {
		await runCaseUpdateTest(harness, async ({account, initialUser}) => {
			const updated = await updateUserProfile(harness, account.token, {
				username: initialUser.username,
				discriminator: initialUser.discriminator,
				password: account.password,
			});
			expect(updated.json.username).toBe(initialUser.username);
			expect(updated.json.discriminator).toBe(initialUser.discriminator);
		});
	});

	test('case-only change with explicit discriminator keeps discriminator', async () => {
		await runCaseUpdateTest(harness, async ({account, initialUser}) => {
			let newUsername = initialUser.username.toLowerCase();
			if (newUsername === initialUser.username) {
				newUsername = initialUser.username.toUpperCase();
			}

			const updated = await updateUserProfile(harness, account.token, {
				username: newUsername,
				discriminator: initialUser.discriminator,
				password: account.password,
			});
			expect(updated.json.username).toBe(newUsername);
			expect(updated.json.discriminator).toBe(initialUser.discriminator);
		});
	});

	test('non-premium username change rerolls even if same discriminator sent', async () => {
		await runCaseUpdateTest(harness, async ({account, initialUser}) => {
			const newUsername = `reroll${initialUser.username.slice(0, Math.min(initialUser.username.length, 26))}`;

			const updated = await updateUserProfile(harness, account.token, {
				username: newUsername,
				discriminator: initialUser.discriminator,
				password: account.password,
			});
			expect(updated.json.username).toBe(newUsername);
			expect(updated.json.discriminator).not.toBe(initialUser.discriminator);
		});
	});
});
