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
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {createFriendship} from '@fluxer/api/src/user/tests/RelationshipTestUtils';
import {
	deleteAccount,
	setPendingDeletionAt,
	triggerDeletionWorker,
	waitForDeletionCompletion,
} from '@fluxer/api/src/user/tests/UserTestUtils';
import {beforeEach, describe, test} from 'vitest';

describe('Account Delete Permanent', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('permanent account deletion removes user data', async () => {
		const account = await createTestAccount(harness);
		const friend = await createTestAccount(harness);

		await createFriendship(harness, account, friend);

		await deleteAccount(harness, account.token, account.password);

		await createBuilder(harness, account.token).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();

		const past = new Date();
		past.setMinutes(past.getMinutes() - 1);
		await setPendingDeletionAt(harness, account.userId, past);

		await triggerDeletionWorker(harness);

		await waitForDeletionCompletion(harness, account.userId);
	});
});
