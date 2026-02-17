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

import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {UserIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	FriendRequestByTagRequest,
	RelationshipNicknameUpdateRequest,
	RelationshipTypePutRequest,
} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import {RelationshipResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {z} from 'zod';

export function UserRelationshipController(app: HonoApp) {
	app.get(
		'/users/@me/relationships',
		RateLimitMiddleware(RateLimitConfigs.USER_RELATIONSHIPS_LIST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_user_relationships',
			summary: 'List user relationships',
			responseSchema: z.array(RelationshipResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves all relationships for the current user, including friends, friend requests (incoming and outgoing), and blocked users. Returns list of relationship objects with type and metadata.',
		}),
		async (ctx) => {
			const response = await ctx.get('userRelationshipRequestService').listRelationships({
				userId: ctx.get('user').id,
				requestCache: ctx.get('requestCache'),
			});
			return ctx.json(response);
		},
	);

	app.post(
		'/users/@me/relationships',
		RateLimitMiddleware(RateLimitConfigs.USER_FRIEND_REQUEST_SEND),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', FriendRequestByTagRequest),
		OpenAPI({
			operationId: 'send_friend_request_by_tag',
			summary: 'Send friend request by tag',
			responseSchema: RelationshipResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Sends a friend request to a user identified by username tag (username#discriminator). Returns the new relationship object. Can fail if user not found or request already sent.',
		}),
		async (ctx) => {
			const response = await ctx.get('userRelationshipRequestService').sendFriendRequestByTag({
				userId: ctx.get('user').id,
				data: ctx.req.valid('json'),
				requestCache: ctx.get('requestCache'),
			});
			return ctx.json(response);
		},
	);

	app.post(
		'/users/@me/relationships/:user_id',
		RateLimitMiddleware(RateLimitConfigs.USER_FRIEND_REQUEST_SEND),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'send_friend_request',
			summary: 'Send friend request',
			responseSchema: RelationshipResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Sends a friend request to a user identified by user ID. Returns the new relationship object. Can fail if user not found or request already sent.',
		}),
		async (ctx) => {
			const response = await ctx.get('userRelationshipRequestService').sendFriendRequest({
				userId: ctx.get('user').id,
				targetId: createUserID(ctx.req.valid('param').user_id),
				requestCache: ctx.get('requestCache'),
			});
			return ctx.json(response);
		},
	);

	app.put(
		'/users/@me/relationships/:user_id',
		RateLimitMiddleware(RateLimitConfigs.USER_FRIEND_REQUEST_ACCEPT),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', UserIdParam),
		Validator('json', RelationshipTypePutRequest),
		OpenAPI({
			operationId: 'accept_or_update_friend_request',
			summary: 'Accept or update friend request',
			responseSchema: RelationshipResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Accepts a pending incoming friend request from a user or updates the relationship type. Can also be used to change friend relationship to blocked status. Returns updated relationship object.',
		}),
		async (ctx) => {
			const response = await ctx.get('userRelationshipRequestService').updateRelationshipType({
				userId: ctx.get('user').id,
				targetId: createUserID(ctx.req.valid('param').user_id),
				data: ctx.req.valid('json'),
				requestCache: ctx.get('requestCache'),
			});
			return ctx.json(response);
		},
	);

	app.delete(
		'/users/@me/relationships/:user_id',
		RateLimitMiddleware(RateLimitConfigs.USER_RELATIONSHIP_DELETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', UserIdParam),
		OpenAPI({
			operationId: 'remove_relationship',
			summary: 'Remove relationship',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Removes a relationship with another user by ID. Removes friends, cancels friend requests (incoming or outgoing), or unblocks a blocked user depending on current relationship type.',
		}),
		async (ctx) => {
			await ctx.get('userRelationshipRequestService').removeRelationship({
				userId: ctx.get('user').id,
				targetId: createUserID(ctx.req.valid('param').user_id),
			});
			return ctx.body(null, 204);
		},
	);

	app.patch(
		'/users/@me/relationships/:user_id',
		RateLimitMiddleware(RateLimitConfigs.USER_RELATIONSHIP_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', UserIdParam),
		Validator('json', RelationshipNicknameUpdateRequest),
		OpenAPI({
			operationId: 'update_relationship_nickname',
			summary: 'Update relationship nickname',
			responseSchema: RelationshipResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				"Updates the nickname associated with a relationship (friend or blocked user). Nicknames are personal labels that override the user's display name in the current user's view. Returns updated relationship object.",
		}),
		async (ctx) => {
			const response = await ctx.get('userRelationshipRequestService').updateNickname({
				userId: ctx.get('user').id,
				targetId: createUserID(ctx.req.valid('param').user_id),
				data: ctx.req.valid('json'),
				requestCache: ctx.get('requestCache'),
			});
			return ctx.json(response);
		},
	);
}
