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

import {timingSafeEqual} from 'node:crypto';
import {Config} from '@fluxer/api/src/Config';
import {Logger} from '@fluxer/api/src/Logger';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import type {HonoApp, HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {UnauthorizedError} from '@fluxer/errors/src/domains/core/UnauthorizedError';
import {RpcRequest, RpcResponse} from '@fluxer/schema/src/domains/rpc/RpcSchemas';
import {createMiddleware} from 'hono/factory';

const InternalNetworkRequired = createMiddleware<HonoEnv>(async (ctx, next) => {
	const authHeader = ctx.req.header('Authorization');
	const expectedAuth = `Bearer ${Config.gateway.rpcSecret}`;
	if (!authHeader) {
		throw new UnauthorizedError();
	}
	const authBuffer = Buffer.from(authHeader, 'utf8');
	const expectedBuffer = Buffer.from(expectedAuth, 'utf8');
	if (authBuffer.length !== expectedBuffer.length || !timingSafeEqual(authBuffer, expectedBuffer)) {
		throw new UnauthorizedError();
	}
	await next();
});

export function RpcController(app: HonoApp) {
	app.post(
		'/_rpc',
		InternalNetworkRequired,
		OpenAPI({
			operationId: 'handle_rpc_request',
			summary: 'Handle internal RPC request',
			description:
				'Internal RPC endpoint for handling inter-service communication. Requires internal network authorization.',
			responseSchema: RpcResponse,
			statusCode: 200,
			security: [],
			tags: 'Gateway',
		}),
		Validator('json', RpcRequest),
		async (ctx) => {
			const request = ctx.req.valid('json');
			if (request.type === 'session') {
				Logger.debug(
					{
						rpcType: request.type,
						version: request.version,
						hasIp: request.ip !== undefined,
						hasLatitude: request.latitude !== undefined,
						hasLongitude: request.longitude !== undefined,
					},
					'RPC session request received',
				);
			} else {
				Logger.debug({rpcType: request.type}, 'RPC request received');
			}
			try {
				const response = await ctx.get('rpcService').handleRpcRequest({request, requestCache: ctx.get('requestCache')});
				return ctx.json(response);
			} catch (error) {
				Logger.warn(
					{
						rpcType: request.type,
						error: error instanceof Error ? error.message : String(error),
					},
					'RPC request failed',
				);
				throw error;
			}
		},
	);
}
