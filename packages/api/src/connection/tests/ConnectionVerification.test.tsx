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
	initiateConnection,
	listConnections,
	verifyAndCreateConnection,
	verifyConnection,
} from '@fluxer/api/src/connection/tests/ConnectionTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {server} from '@fluxer/api/src/test/msw/server';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ConnectionTypes} from '@fluxer/constants/src/ConnectionConstants';
import {HttpResponse, http} from 'msw';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

async function createDomainConnectionViaFlow(
	harness: ApiTestHarness,
	accountToken: string,
	domain: string,
): Promise<{connectionId: string; verificationToken: string}> {
	const verification = await initiateConnection(harness, accountToken, {
		type: ConnectionTypes.DOMAIN,
		identifier: domain,
	});

	const verificationToken = verification.token;

	server.use(
		http.get(`https://${domain}/.well-known/fluxer-verification`, () => {
			return HttpResponse.text(verificationToken);
		}),
	);

	const connection = await verifyAndCreateConnection(harness, accountToken, {
		initiation_token: verification.initiation_token,
	});

	return {connectionId: connection.id, verificationToken};
}

const testHandle = 'testuser.bsky.social';
const testDid = 'did:plc:testuser123';

describe('Connection verification', () => {
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

	describe('Bluesky verification', () => {
		it('verifies successfully when OAuth session is valid', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));

			const connection = await createBlueskyConnectionViaOAuth(harness, account.token, testHandle, testDid, userId);

			harness.mockBlueskyOAuthService.configure({
				restoreAndVerifyResult: {handle: testHandle},
			});

			const result = await verifyConnection(harness, account.token, ConnectionTypes.BLUESKY, connection.id);

			expect(result.verified).toBe(true);
			expect(result.type).toBe(ConnectionTypes.BLUESKY);
			expect(result.name).toBe(testHandle);

			const updatedConnections = await listConnections(harness, account.token);
			expect(updatedConnections[0].verified).toBe(true);
		});

		it('fails verification when OAuth session is expired', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));

			const connection = await createBlueskyConnectionViaOAuth(harness, account.token, testHandle, testDid, userId);

			const connectionsBefore = await listConnections(harness, account.token);
			expect(connectionsBefore[0].verified).toBe(true);

			harness.mockBlueskyOAuthService.configure({
				restoreAndVerifyResult: null,
			});

			await createBuilder(harness, account.token)
				.post(`/users/@me/connections/${ConnectionTypes.BLUESKY}/${connection.id}/verify`)
				.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.CONNECTION_VERIFICATION_FAILED)
				.execute();

			const updatedConnections = await listConnections(harness, account.token);
			expect(updatedConnections[0].verified).toBe(false);
		});

		it('fails verification when OAuth session cannot be restored', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));

			const connection = await createBlueskyConnectionViaOAuth(harness, account.token, testHandle, testDid, userId);

			harness.mockBlueskyOAuthService.configure({
				restoreAndVerifyResult: null,
			});

			await createBuilder(harness, account.token)
				.post(`/users/@me/connections/${ConnectionTypes.BLUESKY}/${connection.id}/verify`)
				.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.CONNECTION_VERIFICATION_FAILED)
				.execute();
		});

		it('fails verification when OAuth restore throws', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));

			const connection = await createBlueskyConnectionViaOAuth(harness, account.token, testHandle, testDid, userId);

			harness.mockBlueskyOAuthService.restoreAndVerifySpy.mockRejectedValue(new Error('OAuth restore failure'));

			await createBuilder(harness, account.token)
				.post(`/users/@me/connections/${ConnectionTypes.BLUESKY}/${connection.id}/verify`)
				.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.CONNECTION_VERIFICATION_FAILED)
				.execute();
		});
	});

	describe('Domain verification', () => {
		it('verifies successfully via well-known endpoint', async () => {
			const account = await createTestAccount(harness);
			const domain = 'example.com';

			const {connectionId, verificationToken} = await createDomainConnectionViaFlow(harness, account.token, domain);

			server.use(
				http.get(`https://${domain}/.well-known/fluxer-verification`, () => {
					return HttpResponse.text(verificationToken);
				}),
			);

			const result = await verifyConnection(harness, account.token, ConnectionTypes.DOMAIN, connectionId);

			expect(result.verified).toBe(true);
			expect(result.type).toBe(ConnectionTypes.DOMAIN);
			expect(result.name).toBe(domain);

			const updatedConnections = await listConnections(harness, account.token);
			expect(updatedConnections[0].verified).toBe(true);
		});

		it('fails verification when well-known endpoint returns wrong token', async () => {
			const account = await createTestAccount(harness);
			const domain = 'example.com';

			const {connectionId} = await createDomainConnectionViaFlow(harness, account.token, domain);

			const connectionsBefore = await listConnections(harness, account.token);
			expect(connectionsBefore[0].verified).toBe(true);

			server.use(
				http.get(`https://${domain}/.well-known/fluxer-verification`, () => {
					return HttpResponse.text('wrong-token');
				}),
			);

			await createBuilder(harness, account.token)
				.post(`/users/@me/connections/${ConnectionTypes.DOMAIN}/${connectionId}/verify`)
				.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.CONNECTION_VERIFICATION_FAILED)
				.execute();

			const updatedConnections = await listConnections(harness, account.token);
			expect(updatedConnections[0].verified).toBe(false);
		});

		it('fails verification when well-known endpoint is not found', async () => {
			const account = await createTestAccount(harness);
			const domain = 'example.com';

			const {connectionId} = await createDomainConnectionViaFlow(harness, account.token, domain);

			server.use(
				http.get(`https://${domain}/.well-known/fluxer-verification`, () => {
					return HttpResponse.text('Not found', {status: 404});
				}),
			);

			await createBuilder(harness, account.token)
				.post(`/users/@me/connections/${ConnectionTypes.DOMAIN}/${connectionId}/verify`)
				.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.CONNECTION_VERIFICATION_FAILED)
				.execute();
		});

		it('fails verification when well-known endpoint returns 500', async () => {
			const account = await createTestAccount(harness);
			const domain = 'example.com';

			const {connectionId} = await createDomainConnectionViaFlow(harness, account.token, domain);

			server.use(
				http.get(`https://${domain}/.well-known/fluxer-verification`, () => {
					return HttpResponse.text('Internal server error', {status: 500});
				}),
			);

			await createBuilder(harness, account.token)
				.post(`/users/@me/connections/${ConnectionTypes.DOMAIN}/${connectionId}/verify`)
				.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.CONNECTION_VERIFICATION_FAILED)
				.execute();
		});
	});

	describe('Verification errors', () => {
		it('returns CONNECTION_NOT_FOUND for non-existent connection', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post(`/users/@me/connections/${ConnectionTypes.BLUESKY}/nonexistent/verify`)
				.expect(HTTP_STATUS.NOT_FOUND, APIErrorCodes.CONNECTION_NOT_FOUND)
				.execute();
		});

		it('allows re-verification of already verified connection', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));

			const connection = await createBlueskyConnectionViaOAuth(harness, account.token, testHandle, testDid, userId);

			harness.mockBlueskyOAuthService.configure({
				restoreAndVerifyResult: {handle: testHandle},
			});

			await verifyConnection(harness, account.token, ConnectionTypes.BLUESKY, connection.id);

			const result = await verifyConnection(harness, account.token, ConnectionTypes.BLUESKY, connection.id);
			expect(result.verified).toBe(true);
		});
	});
});
