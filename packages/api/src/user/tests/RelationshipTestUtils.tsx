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

import {createFriendship as channelCreateFriendship} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import type {RelationshipResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {expect} from 'vitest';

export async function sendFriendRequest(
	harness: ApiTestHarness,
	token: string,
	targetId: string,
): Promise<{response: Response; json: RelationshipResponse}> {
	const {response, json} = await createBuilder<RelationshipResponse>(harness, token)
		.post(`/users/@me/relationships/${targetId}`)
		.executeWithResponse();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}`);
	}
	return {response, json};
}

export async function sendFriendRequestByTag(
	harness: ApiTestHarness,
	token: string,
	username: string,
	discriminator: string,
): Promise<{response: Response; json: RelationshipResponse}> {
	const {response, json} = await createBuilder<RelationshipResponse>(harness, token)
		.post('/users/@me/relationships')
		.body({username, discriminator})
		.executeWithResponse();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}`);
	}
	return {response, json};
}

export async function acceptFriendRequest(
	harness: ApiTestHarness,
	token: string,
	targetId: string,
): Promise<{response: Response; json: RelationshipResponse}> {
	const {response, json} = await createBuilder<RelationshipResponse>(harness, token)
		.put(`/users/@me/relationships/${targetId}`)
		.body({})
		.executeWithResponse();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}`);
	}
	return {response, json};
}

export async function blockUser(
	harness: ApiTestHarness,
	token: string,
	targetId: string,
): Promise<{response: Response; json: RelationshipResponse}> {
	const {response, json} = await createBuilder<RelationshipResponse>(harness, token)
		.put(`/users/@me/relationships/${targetId}`)
		.body({type: RelationshipTypes.BLOCKED})
		.executeWithResponse();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}`);
	}
	return {response, json};
}

export async function removeRelationship(harness: ApiTestHarness, token: string, targetId: string): Promise<void> {
	await createBuilder<void>(harness, token).delete(`/users/@me/relationships/${targetId}`).expect(204).execute();
}

export async function listRelationships(
	harness: ApiTestHarness,
	token: string,
): Promise<{response: Response; json: Array<RelationshipResponse>}> {
	const {response, json} = await createBuilder<Array<RelationshipResponse>>(harness, token)
		.get('/users/@me/relationships')
		.executeWithResponse();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}`);
	}
	return {response, json};
}

export async function updateFriendNickname(
	harness: ApiTestHarness,
	token: string,
	targetId: string,
	nickname: string | null,
): Promise<{response: Response; json: RelationshipResponse}> {
	const {response, json} = await createBuilder<RelationshipResponse>(harness, token)
		.patch(`/users/@me/relationships/${targetId}`)
		.body({nickname})
		.executeWithResponse();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}`);
	}
	return {response, json};
}

export function assertRelationshipType(relationship: RelationshipResponse, expectedType: number): void {
	expect(relationship.type).toBe(expectedType);
}

export function assertRelationshipId(relationship: RelationshipResponse, expectedId: string): void {
	expect(relationship.id).toBe(expectedId);
}

export function findRelationship(relations: Array<RelationshipResponse>, userId: string): RelationshipResponse | null {
	return relations.find((r) => r.id === userId) ?? null;
}

export const createFriendship = channelCreateFriendship;
