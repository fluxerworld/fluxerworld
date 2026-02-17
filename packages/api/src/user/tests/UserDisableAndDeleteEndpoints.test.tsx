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
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {deleteAccount, disableAccount} from '@fluxer/api/src/user/tests/UserTestUtils';
import {beforeEach, describe, expect, test} from 'vitest';

describe('User Disable And Delete Endpoints', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('disable and delete flow works correctly', async () => {
		const account = await createTestAccount(harness);

		await disableAccount(harness, account.token, account.password);

		await createBuilder(harness, account.token).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();

		const login = await loginAccount(harness, account);
		const newToken = login.token;

		await deleteAccount(harness, newToken, account.password);

		await createBuilder(harness, newToken).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();

		const loginAfterDelete = await loginAccount(harness, account);
		expect(loginAfterDelete.token).not.toBe('');
	});
});
