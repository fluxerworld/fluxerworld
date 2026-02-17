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
	listRelationships,
	sendFriendRequest,
	updateFriendNickname,
} from '@fluxer/api/src/user/tests/RelationshipTestUtils';
import {beforeEach, describe, expect, test} from 'vitest';

describe('RelationshipNicknameUpdate', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('update friend nickname', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);

		await sendFriendRequest(harness, alice.token, bob.userId);

		await acceptFriendRequest(harness, bob.token, alice.userId);

		const {json: updated} = await updateFriendNickname(harness, alice.token, bob.userId, 'Bestie Bob');
		expect(updated.nickname).toBe('Bestie Bob');

		const {json: aliceRels} = await listRelationships(harness, alice.token);
		const bobRel = aliceRels.find((r) => r.id === bob.userId);
		expect(bobRel?.nickname).toBe('Bestie Bob');

		const {json: bobRels} = await listRelationships(harness, bob.token);
		const aliceRel = bobRels.find((r) => r.id === alice.userId);
		expect(aliceRel?.nickname).toBeNull();
	});

	test('remove friend nickname', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);

		await sendFriendRequest(harness, alice.token, bob.userId);
		await acceptFriendRequest(harness, bob.token, alice.userId);

		await updateFriendNickname(harness, alice.token, bob.userId, 'Bobby');

		const {json: updated} = await updateFriendNickname(harness, alice.token, bob.userId, null);
		expect(updated.nickname).toBeNull();

		const {json: aliceRels} = await listRelationships(harness, alice.token);
		const bobRel = aliceRels.find((r) => r.id === bob.userId);
		expect(bobRel?.nickname).toBeNull();
	});
});
