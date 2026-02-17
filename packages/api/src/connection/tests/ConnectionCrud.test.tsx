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
import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {
	createBlueskyConnectionViaOAuth,
	createBlueskyDid,
	createBlueskyHandle,
	deleteConnection,
	initiateConnection,
	listConnections,
	reorderConnections,
	updateConnection,
} from '@fluxer/api/src/connection/tests/ConnectionTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ConnectionTypes, ConnectionVisibilityFlags} from '@fluxer/constants/src/ConnectionConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Connection CRUD', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	describe('List connections', () => {
		it('returns empty array initially', async () => {
			const account = await createTestAccount(harness);
			const connections = await listConnections(harness, account.token);
			expect(connections).toEqual([]);
		});

		it('returns created connections', async () => {
			const account = await createTestAccount(harness);
			const handle = createBlueskyHandle('testuser');
			const did = createBlueskyDid('testuser');
			const userId = createUserID(BigInt(account.userId));

			await createBlueskyConnectionViaOAuth(harness, account.token, handle, did, userId);

			const connections = await listConnections(harness, account.token);
			expect(connections).toHaveLength(1);
			expect(connections[0].type).toBe(ConnectionTypes.BLUESKY);
			expect(connections[0].name).toBe(handle);
			expect(connections[0].verified).toBe(true);
		});

		it('requires authentication', async () => {
			await createBuilderWithoutAuth(harness).get('/users/@me/connections').expect(HTTP_STATUS.UNAUTHORIZED).execute();
		});
	});

	describe('Initiate connection', () => {
		it('rejects Bluesky type from initiate endpoint', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/users/@me/connections')
				.body({
					type: ConnectionTypes.BLUESKY,
					identifier: 'test.bsky.social',
				})
				.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.BLUESKY_OAUTH_NOT_ENABLED)
				.execute();
		});

		it('initiates valid domain connection', async () => {
			const account = await createTestAccount(harness);
			const domain = 'example.com';

			const verification = await initiateConnection(harness, account.token, {
				type: ConnectionTypes.DOMAIN,
				identifier: domain,
			});

			expect(verification.type).toBe(ConnectionTypes.DOMAIN);
			expect(verification.id).toBe(domain);
			expect(verification.token).toBeTruthy();
			expect(verification.token.length).toBeGreaterThan(0);
			expect(verification.instructions).toBeTruthy();
			expect(verification.initiation_token).toBeTruthy();
			expect(verification.initiation_token.length).toBeGreaterThan(0);
		});

		it('does not create a DB record for domain initiation', async () => {
			const account = await createTestAccount(harness);
			const domain = 'example.com';

			await initiateConnection(harness, account.token, {
				type: ConnectionTypes.DOMAIN,
				identifier: domain,
			});

			const connections = await listConnections(harness, account.token);
			expect(connections).toHaveLength(0);
		});

		it('returns INVALID_FORM_BODY for invalid type', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/users/@me/connections')
				.body({
					type: 'invalid_type',
					identifier: 'test',
				})
				.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.INVALID_FORM_BODY)
				.execute();
		});

		it('returns CONNECTION_LIMIT_REACHED when limit exceeded', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));

			for (let i = 0; i < 20; i++) {
				await createBlueskyConnectionViaOAuth(
					harness,
					account.token,
					createBlueskyHandle(`user${i}`),
					createBlueskyDid(`user${i}`),
					userId,
				);
			}

			harness.mockBlueskyOAuthService.configure({
				callbackResult: {
					userId,
					did: createBlueskyDid('user21'),
					handle: createBlueskyHandle('user21'),
				},
			});

			const response = await harness.requestJson({
				path: '/connections/bluesky/callback?code=mock&state=mock&iss=mock',
				method: 'GET',
				headers: {Authorization: account.token},
			});

			expect(response.status).toBe(302);
			const location = response.headers.get('location') ?? '';
			expect(location).toContain('status=error');
		});

		it('requires authentication', async () => {
			await createBuilderWithoutAuth(harness)
				.post('/users/@me/connections')
				.body({
					type: ConnectionTypes.DOMAIN,
					identifier: 'example.com',
				})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});

	describe('Verify and create connection', () => {
		it('returns CONNECTION_INITIATION_TOKEN_INVALID for expired token', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/users/@me/connections/verify')
				.body({
					initiation_token: 'expired.token.value',
				})
				.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CONNECTION_INITIATION_TOKEN_INVALID)
				.execute();
		});

		it('returns CONNECTION_INITIATION_TOKEN_INVALID for tampered token', async () => {
			const account = await createTestAccount(harness);
			const domain = 'example.com';

			const verification = await initiateConnection(harness, account.token, {
				type: ConnectionTypes.DOMAIN,
				identifier: domain,
			});

			const tamperedToken = `${verification.initiation_token}tampered`;

			await createBuilder(harness, account.token)
				.post('/users/@me/connections/verify')
				.body({
					initiation_token: tamperedToken,
				})
				.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CONNECTION_INITIATION_TOKEN_INVALID)
				.execute();
		});

		it('requires authentication', async () => {
			await createBuilderWithoutAuth(harness)
				.post('/users/@me/connections/verify')
				.body({
					initiation_token: 'some-token',
				})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});

	describe('Bluesky OAuth connection', () => {
		it('creates connection via OAuth flow', async () => {
			const account = await createTestAccount(harness);
			const handle = createBlueskyHandle('testuser');
			const did = createBlueskyDid('testuser');
			const userId = createUserID(BigInt(account.userId));

			const connection = await createBlueskyConnectionViaOAuth(harness, account.token, handle, did, userId);

			expect(connection.type).toBe(ConnectionTypes.BLUESKY);
			expect(connection.name).toBe(handle);
			expect(connection.verified).toBe(true);
		});

		it('accepts visibility_flags via OAuth flow', async () => {
			const account = await createTestAccount(harness);
			const handle = createBlueskyHandle('testuser');
			const did = createBlueskyDid('testuser');
			const userId = createUserID(BigInt(account.userId));

			const connection = await createBlueskyConnectionViaOAuth(harness, account.token, handle, did, userId, {
				visibility_flags: ConnectionVisibilityFlags.FRIENDS,
			});

			expect(connection.visibility_flags).toBe(ConnectionVisibilityFlags.FRIENDS);
		});

		it('updates existing connection on re-authorisation', async () => {
			const account = await createTestAccount(harness);
			const handle = createBlueskyHandle('testuser');
			const newHandle = 'newalias.bsky.social';
			const did = createBlueskyDid('testuser');
			const userId = createUserID(BigInt(account.userId));

			await createBlueskyConnectionViaOAuth(harness, account.token, handle, did, userId);

			harness.mockBlueskyOAuthService.configure({
				callbackResult: {userId, did, handle: newHandle},
			});

			await harness.requestJson({
				path: '/connections/bluesky/callback?code=mock&state=mock&iss=mock',
				method: 'GET',
				headers: {Authorization: account.token},
			});

			const connections = await listConnections(harness, account.token);
			expect(connections).toHaveLength(1);
			expect(connections[0].name).toBe(newHandle);
			expect(connections[0].verified).toBe(true);
		});
	});

	describe('Update connection', () => {
		it('updates visibility_flags', async () => {
			const account = await createTestAccount(harness);
			const handle = createBlueskyHandle('testuser');
			const did = createBlueskyDid('testuser');
			const userId = createUserID(BigInt(account.userId));

			await createBlueskyConnectionViaOAuth(harness, account.token, handle, did, userId);

			const connections = await listConnections(harness, account.token);
			const connectionId = connections[0].id;

			await updateConnection(harness, account.token, ConnectionTypes.BLUESKY, connectionId, {
				visibility_flags: ConnectionVisibilityFlags.MUTUAL_GUILDS,
			});

			const updatedConnections = await listConnections(harness, account.token);
			expect(updatedConnections[0].visibility_flags).toBe(ConnectionVisibilityFlags.MUTUAL_GUILDS);
		});

		it('updates sort_order', async () => {
			const account = await createTestAccount(harness);
			const handle = createBlueskyHandle('testuser');
			const did = createBlueskyDid('testuser');
			const userId = createUserID(BigInt(account.userId));

			await createBlueskyConnectionViaOAuth(harness, account.token, handle, did, userId);

			const connections = await listConnections(harness, account.token);
			const connectionId = connections[0].id;

			await updateConnection(harness, account.token, ConnectionTypes.BLUESKY, connectionId, {
				sort_order: 5,
			});

			const updatedConnections = await listConnections(harness, account.token);
			expect(updatedConnections[0].sort_order).toBe(5);
		});

		it('returns CONNECTION_NOT_FOUND for non-existent connection', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.patch(`/users/@me/connections/${ConnectionTypes.BLUESKY}/nonexistent`)
				.body({visibility_flags: ConnectionVisibilityFlags.EVERYONE})
				.expect(HTTP_STATUS.NOT_FOUND, APIErrorCodes.CONNECTION_NOT_FOUND)
				.execute();
		});

		it('requires authentication', async () => {
			await createBuilderWithoutAuth(harness)
				.patch(`/users/@me/connections/${ConnectionTypes.BLUESKY}/test`)
				.body({visibility_flags: ConnectionVisibilityFlags.EVERYONE})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});

	describe('Delete connection', () => {
		it('deletes existing connection', async () => {
			const account = await createTestAccount(harness);
			const handle = createBlueskyHandle('testuser');
			const did = createBlueskyDid('testuser');
			const userId = createUserID(BigInt(account.userId));

			await createBlueskyConnectionViaOAuth(harness, account.token, handle, did, userId);

			const connections = await listConnections(harness, account.token);
			const connectionId = connections[0].id;

			await deleteConnection(harness, account.token, ConnectionTypes.BLUESKY, connectionId);

			const updatedConnections = await listConnections(harness, account.token);
			expect(updatedConnections).toHaveLength(0);
		});

		it('returns CONNECTION_NOT_FOUND for non-existent connection', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.delete(`/users/@me/connections/${ConnectionTypes.BLUESKY}/nonexistent`)
				.expect(HTTP_STATUS.NOT_FOUND, APIErrorCodes.CONNECTION_NOT_FOUND)
				.execute();
		});

		it('requires authentication', async () => {
			await createBuilderWithoutAuth(harness)
				.delete(`/users/@me/connections/${ConnectionTypes.BLUESKY}/test`)
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});

	describe('Reorder connections', () => {
		it('reorders multiple connections', async () => {
			const account = await createTestAccount(harness);
			const handle1 = createBlueskyHandle('user1');
			const handle2 = createBlueskyHandle('user2');
			const did1 = createBlueskyDid('user1');
			const did2 = createBlueskyDid('user2');
			const userId = createUserID(BigInt(account.userId));

			await createBlueskyConnectionViaOAuth(harness, account.token, handle1, did1, userId);
			await createBlueskyConnectionViaOAuth(harness, account.token, handle2, did2, userId);

			const connections = await listConnections(harness, account.token);
			const id1 = connections[0].id;
			const id2 = connections[1].id;

			await reorderConnections(harness, account.token, [id2, id1]);

			const reordered = await listConnections(harness, account.token);
			const conn1 = reordered.find((c) => c.id === id1);
			const conn2 = reordered.find((c) => c.id === id2);

			expect(conn2?.sort_order).toBe(0);
			expect(conn1?.sort_order).toBe(1);
		});

		it('requires authentication', async () => {
			await createBuilderWithoutAuth(harness)
				.patch('/users/@me/connections/reorder')
				.body({connection_ids: ['id1', 'id2']})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});
});
