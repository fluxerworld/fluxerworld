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

import {createTestAccount, loginAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createGuild} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {deleteAccount, expectDataExists} from '@fluxer/api/src/user/tests/UserTestUtils';
import {beforeEach, describe, expect, test} from 'vitest';

describe('Account Deletion Grace Period', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('account deletion enters grace period and allows login', async () => {
		const account = await createTestAccount(harness);

		await deleteAccount(harness, account.token, account.password);

		await createBuilder(harness, account.token).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();

		const dataBeforeLogin = await expectDataExists(harness, account.userId);
		expect(dataBeforeLogin.hasSelfDeletedFlag).toBe(true);
		expect(dataBeforeLogin.pendingDeletionAt).not.toBeNull();

		const loginAfterDelete = await loginAccount(harness, account);
		expect(loginAfterDelete.token).not.toBe('');

		const dataAfterLogin = await expectDataExists(harness, account.userId);
		expect(dataAfterLogin.hasSelfDeletedFlag).toBe(false);
		expect(dataAfterLogin.pendingDeletionAt).toBeNull();
	});

	test('account deletion is blocked while user owns guilds', async () => {
		const account = await createTestAccount(harness);

		await createGuild(harness, account.token, 'Owned Guild');

		await createBuilder(harness, account.token)
			.post('/users/@me/delete')
			.body({password: account.password})
			.expect(HTTP_STATUS.BAD_REQUEST, 'USER_OWNS_GUILDS')
			.execute();
	});
});
