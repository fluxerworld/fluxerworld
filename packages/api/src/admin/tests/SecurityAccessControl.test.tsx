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

import {createTestAccount, setUserACLs} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeEach, describe, test} from 'vitest';

describe('Security Access Control', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	describe('Blocked User Restrictions', () => {
		test('blocked user cannot send friend request', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);

			await createBuilder(harness, `Bearer ${user1.token}`)
				.put(`/users/@me/relationships/${user2.userId}`)
				.body({
					type: 2,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder(harness, `Bearer ${user2.token}`)
				.post(`/users/@me/relationships/${user1.userId}`)
				.body(null)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('blocked user cannot create DM', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);

			await createBuilder(harness, `Bearer ${user1.token}`)
				.put(`/users/@me/relationships/${user2.userId}`)
				.body({
					type: 2,
				})
				.execute();

			await createBuilder(harness, `Bearer ${user2.token}`)
				.post('/users/@me/channels')
				.body({
					recipients: [user1.userId],
				})
				.expect(HTTP_STATUS.BAD_REQUEST, 'NOT_FRIENDS_WITH_USER')
				.execute();
		});
	});

	describe('Unauthorized Access', () => {
		test('unauthorized user cannot access other users @me endpoint', async () => {
			const user1 = await createTestAccount(harness);
			await createTestAccount(harness);

			await createBuilder(harness, `Bearer ${user1.token}`).get('/users/@me').expect(HTTP_STATUS.OK).execute();
		});

		test('unauthorized access without token is rejected', async () => {
			await createBuilderWithoutAuth(harness).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
		});

		test('unauthorized access with invalid token is rejected', async () => {
			await createBuilder(harness, 'Bearer invalid_token_12345')
				.get('/users/@me')
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});

		test('unauthorized guild access is rejected', async () => {
			const owner = await createTestAccount(harness);
			const attacker = await createTestAccount(harness);

			const createJson = await createBuilder<{id: string}>(harness, `Bearer ${owner.token}`)
				.post('/guilds')
				.body({
					name: 'Private Guild',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const guildId = createJson.id;

			await createBuilder(harness, `Bearer ${attacker.token}`)
				.get(`/guilds/${guildId}`)
				.expect(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED')
				.execute();
		});

		test('unauthorized channel access is rejected', async () => {
			const owner = await createTestAccount(harness);
			const attacker = await createTestAccount(harness);

			const createJson = await createBuilder<{id: string}>(harness, `Bearer ${owner.token}`)
				.post('/guilds')
				.body({
					name: 'Private Guild',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const guildId = createJson.id;

			await createBuilder(harness, `Bearer ${attacker.token}`)
				.get(`/guilds/${guildId}/channels`)
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_GUILD')
				.execute();
		});
	});

	describe('Admin Endpoint Security', () => {
		test('admin endpoints require admin authentication', async () => {
			const regularUser = await createTestAccount(harness);

			await createBuilder(harness, `Bearer ${regularUser.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [regularUser.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('admin endpoints require proper ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate']);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('admin endpoints succeed with proper ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});
	});

	describe('Token Security', () => {
		test('token must have valid format', async () => {
			await createBuilder(harness, 'Bearer invalid_format')
				.get('/users/@me')
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});

		test('empty token is rejected', async () => {
			await createBuilder(harness, 'Bearer ').get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
		});

		test('malformed token is rejected', async () => {
			await createBuilder(harness, 'Bearer flx_invalid_token_format')
				.get('/users/@me')
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});
});
