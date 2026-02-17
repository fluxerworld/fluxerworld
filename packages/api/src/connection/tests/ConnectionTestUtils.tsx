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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {BlueskyAuthorizeResponse} from '@fluxer/schema/src/domains/connection/BlueskyOAuthSchemas';
import type {
	ConnectionListResponse,
	ConnectionResponse,
	ConnectionVerificationResponse,
	CreateConnectionRequest,
	VerifyAndCreateConnectionRequest,
} from '@fluxer/schema/src/domains/connection/ConnectionSchemas';

export async function initiateConnection(
	harness: ApiTestHarness,
	token: string,
	request: CreateConnectionRequest,
): Promise<ConnectionVerificationResponse> {
	return await createBuilder<ConnectionVerificationResponse>(harness, token)
		.post('/users/@me/connections')
		.body(request)
		.expect(201)
		.execute();
}

export async function verifyAndCreateConnection(
	harness: ApiTestHarness,
	token: string,
	request: VerifyAndCreateConnectionRequest,
): Promise<ConnectionResponse> {
	return await createBuilder<ConnectionResponse>(harness, token)
		.post('/users/@me/connections/verify')
		.body(request)
		.expect(201)
		.execute();
}

export async function listConnections(harness: ApiTestHarness, token: string): Promise<ConnectionListResponse> {
	return await createBuilder<ConnectionListResponse>(harness, token)
		.get('/users/@me/connections')
		.expect(200)
		.execute();
}

export async function verifyConnection(
	harness: ApiTestHarness,
	token: string,
	type: string,
	connectionId: string,
): Promise<ConnectionResponse> {
	return await createBuilder<ConnectionResponse>(harness, token)
		.post(`/users/@me/connections/${type}/${connectionId}/verify`)
		.expect(200)
		.execute();
}

export async function deleteConnection(
	harness: ApiTestHarness,
	token: string,
	type: string,
	connectionId: string,
): Promise<void> {
	await createBuilder(harness, token).delete(`/users/@me/connections/${type}/${connectionId}`).expect(204).execute();
}

export async function updateConnection(
	harness: ApiTestHarness,
	token: string,
	type: string,
	connectionId: string,
	body: {visibility_flags?: number; sort_order?: number},
): Promise<void> {
	await createBuilder(harness, token)
		.patch(`/users/@me/connections/${type}/${connectionId}`)
		.body(body)
		.expect(204)
		.execute();
}

export async function reorderConnections(
	harness: ApiTestHarness,
	token: string,
	connectionIds: Array<string>,
): Promise<void> {
	await createBuilder(harness, token)
		.patch('/users/@me/connections/reorder')
		.body({connection_ids: connectionIds})
		.expect(204)
		.execute();
}

export async function createVerifiedConnection(
	harness: ApiTestHarness,
	token: string,
	request: CreateConnectionRequest,
	initiationToken: string,
): Promise<ConnectionResponse> {
	return verifyAndCreateConnection(harness, token, {
		initiation_token: initiationToken,
		visibility_flags: request.visibility_flags,
	});
}

export async function authorizeBlueskyConnection(
	harness: ApiTestHarness,
	token: string,
	handle: string,
): Promise<BlueskyAuthorizeResponse> {
	return await createBuilder<BlueskyAuthorizeResponse>(harness, token)
		.post('/users/@me/connections/bluesky/authorize')
		.body({handle})
		.expect(200)
		.execute();
}

export async function createBlueskyConnectionViaOAuth(
	harness: ApiTestHarness,
	token: string,
	handle: string,
	did: string,
	userId: UserID,
	options?: {visibility_flags?: number},
): Promise<ConnectionResponse> {
	harness.mockBlueskyOAuthService.configure({
		callbackResult: {userId, did, handle},
	});

	await authorizeBlueskyConnection(harness, token, handle);

	await harness.requestJson({
		path: `/connections/bluesky/callback?code=mock_code&state=mock_state&iss=mock_iss`,
		method: 'GET',
		headers: {Authorization: token},
	});

	const connections = await listConnections(harness, token);
	const connection = connections.find((c) => c.name === handle);
	if (!connection) {
		throw new Error(`Bluesky connection for handle '${handle}' was not created`);
	}

	if (options?.visibility_flags !== undefined) {
		await updateConnection(harness, token, connection.type, connection.id, {
			visibility_flags: options.visibility_flags,
		});
		const updatedConnections = await listConnections(harness, token);
		return updatedConnections.find((c) => c.id === connection.id)!;
	}

	return connection;
}

export function createBlueskyHandle(username: string): string {
	return `${username}.bsky.social`;
}

export function createBlueskyDid(username: string): string {
	return `did:plc:${username}123`;
}
