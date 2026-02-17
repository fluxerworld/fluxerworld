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
import {
	acceptFriendRequest,
	assertRelationshipId,
	assertRelationshipType,
	listRelationships,
	sendFriendRequest,
} from '@fluxer/api/src/user/tests/RelationshipTestUtils';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {beforeEach, describe, expect, test} from 'vitest';

describe('RelationshipAcceptAfterPrivacyChangeAllowsExistingRequest', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('accepting friend request after privacy change allows existing request', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);

		await sendFriendRequest(harness, alice.token, bob.userId);

		await createBuilder(harness, bob.token)
			.patch('/users/@me/settings')
			.body({friend_source_flags: 3})
			.expect(HTTP_STATUS.OK)
			.execute();

		const {json: accepted} = await acceptFriendRequest(harness, bob.token, alice.userId);
		assertRelationshipId(accepted, alice.userId);
		assertRelationshipType(accepted, RelationshipTypes.FRIEND);

		const {json: aliceRels} = await listRelationships(harness, alice.token);
		expect(aliceRels).toHaveLength(1);
		assertRelationshipId(aliceRels[0]!, bob.userId);
		assertRelationshipType(aliceRels[0]!, RelationshipTypes.FRIEND);
	});
});
