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

import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {requireOAuth2ScopeForBearer} from '@fluxer/api/src/middleware/OAuth2ScopeMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {ConnectionRateLimitConfigs} from '@fluxer/api/src/rate_limit_configs/ConnectionRateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {
	ConnectionListResponse,
	ConnectionResponse,
	ConnectionTypeParam,
	ConnectionVerificationResponse,
	CreateConnectionRequest,
	ReorderConnectionsRequest,
	UpdateConnectionRequest,
	VerifyAndCreateConnectionRequest,
} from '@fluxer/schema/src/domains/connection/ConnectionSchemas';

export function ConnectionController(app: HonoApp) {
	app.get(
		'/users/@me/connections',
		RateLimitMiddleware(ConnectionRateLimitConfigs.CONNECTION_LIST),
		requireOAuth2ScopeForBearer('connections'),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_connections',
			summary: 'List user connections',
			responseSchema: ConnectionListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Connections'],
			description: 'Retrieves all external service connections for the authenticated user.',
		}),
		async (ctx) => {
			const connections = await ctx.get('connectionRequestService').listConnections(ctx.get('user').id);
			return ctx.json(connections);
		},
	);

	app.post(
		'/users/@me/connections',
		RateLimitMiddleware(ConnectionRateLimitConfigs.CONNECTION_CREATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', CreateConnectionRequest),
		OpenAPI({
			operationId: 'initiate_connection',
			summary: 'Initiate connection',
			responseSchema: ConnectionVerificationResponse,
			statusCode: 201,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Connections'],
			description:
				'Initiates a new external service connection and returns verification instructions. No database record is created until verification succeeds.',
		}),
		async (ctx) => {
			const verification = await ctx
				.get('connectionRequestService')
				.initiateConnection(ctx.get('user').id, ctx.req.valid('json'));
			return ctx.json(verification, 201);
		},
	);

	app.post(
		'/users/@me/connections/verify',
		RateLimitMiddleware(ConnectionRateLimitConfigs.CONNECTION_VERIFY_AND_CREATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', VerifyAndCreateConnectionRequest),
		OpenAPI({
			operationId: 'verify_and_create_connection',
			summary: 'Verify and create connection',
			responseSchema: ConnectionResponse,
			statusCode: 201,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Connections'],
			description:
				'Verifies the external service connection using the initiation token and creates the connection record on success.',
		}),
		async (ctx) => {
			const connection = await ctx
				.get('connectionRequestService')
				.verifyAndCreateConnection(ctx.get('user').id, ctx.req.valid('json'));
			return ctx.json(connection, 201);
		},
	);

	app.patch(
		'/users/@me/connections/:type/:connection_id',
		RateLimitMiddleware(ConnectionRateLimitConfigs.CONNECTION_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ConnectionTypeParam),
		Validator('json', UpdateConnectionRequest),
		OpenAPI({
			operationId: 'update_connection',
			summary: 'Update connection',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Connections'],
			description: 'Updates visibility and sort order settings for an external service connection.',
		}),
		async (ctx) => {
			const {type, connection_id} = ctx.req.valid('param');
			await ctx
				.get('connectionRequestService')
				.updateConnection(ctx.get('user').id, type, connection_id, ctx.req.valid('json'));
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/users/@me/connections/:type/:connection_id',
		RateLimitMiddleware(ConnectionRateLimitConfigs.CONNECTION_DELETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ConnectionTypeParam),
		OpenAPI({
			operationId: 'delete_connection',
			summary: 'Delete connection',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Connections'],
			description: "Removes an external service connection from the authenticated user's profile.",
		}),
		async (ctx) => {
			const {type, connection_id} = ctx.req.valid('param');
			await ctx.get('connectionRequestService').deleteConnection(ctx.get('user').id, type, connection_id);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/connections/:type/:connection_id/verify',
		RateLimitMiddleware(ConnectionRateLimitConfigs.CONNECTION_VERIFY),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ConnectionTypeParam),
		OpenAPI({
			operationId: 'verify_connection',
			summary: 'Verify connection',
			responseSchema: ConnectionResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Connections'],
			description: 'Triggers verification for an external service connection.',
		}),
		async (ctx) => {
			const {type, connection_id} = ctx.req.valid('param');
			const connection = await ctx
				.get('connectionRequestService')
				.verifyConnection(ctx.get('user').id, type, connection_id);
			return ctx.json(connection);
		},
	);

	app.patch(
		'/users/@me/connections/reorder',
		RateLimitMiddleware(ConnectionRateLimitConfigs.CONNECTION_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', ReorderConnectionsRequest),
		OpenAPI({
			operationId: 'reorder_connections',
			summary: 'Reorder connections',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Connections'],
			description: 'Updates the display order of multiple connections in a single operation.',
		}),
		async (ctx) => {
			const body = ctx.req.valid('json');
			await ctx.get('connectionRequestService').reorderConnections(ctx.get('user').id, body.connection_ids);
			return ctx.body(null, 204);
		},
	);
}
