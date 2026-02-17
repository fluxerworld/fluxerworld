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
import {
	acceptFriendRequest,
	assertRelationshipId,
	assertRelationshipType,
	blockUser,
	listRelationships,
	removeRelationship,
	sendFriendRequest,
} from '@fluxer/api/src/user/tests/RelationshipTestUtils';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {beforeEach, describe, expect, test} from 'vitest';

describe('UserRelationshipEndpoints', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('friend request lifecycle', async () => {
		const requester = await createTestAccount(harness);
		const target = await createTestAccount(harness);

		const {json: outgoing} = await sendFriendRequest(harness, requester.token, target.userId);
		assertRelationshipId(outgoing, target.userId);
		assertRelationshipType(outgoing, RelationshipTypes.OUTGOING_REQUEST);

		const {json: targetRels} = await listRelationships(harness, target.token);
		expect(targetRels).toHaveLength(1);
		expect(targetRels[0]!.type).toBe(RelationshipTypes.INCOMING_REQUEST);
		assertRelationshipId(targetRels[0]!, requester.userId);

		const {json: accepted} = await acceptFriendRequest(harness, target.token, requester.userId);
		assertRelationshipId(accepted, requester.userId);
		assertRelationshipType(accepted, RelationshipTypes.FRIEND);

		const {json: requesterRels} = await listRelationships(harness, requester.token);
		expect(requesterRels).toHaveLength(1);
		assertRelationshipType(requesterRels[0]!, RelationshipTypes.FRIEND);
		assertRelationshipId(requesterRels[0]!, target.userId);

		await removeRelationship(harness, requester.token, target.userId);

		const {json: afterDelete} = await listRelationships(harness, target.token);
		expect(afterDelete).toHaveLength(0);

		const {json: blocked} = await blockUser(harness, target.token, requester.userId);
		assertRelationshipType(blocked, RelationshipTypes.BLOCKED);
		assertRelationshipId(blocked, requester.userId);
	});
});
