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

import {Config} from '@fluxer/api/src/Config';
import {HttpResponse, http} from 'msw';

interface GatewayRpcRequest {
	method: string;
	params: Record<string, unknown>;
}

interface GatewayRpcResponse {
	result?: unknown;
	error?: string;
}

export interface GatewayRpcRequestCapture {
	method: string;
	params: Record<string, unknown>;
	authorization?: string;
}

export type GatewayRpcMockResponses = Map<string, unknown>;

export function createGatewayRpcHandler(
	mockResponses: GatewayRpcMockResponses = new Map(),
	requestCapture?: {current: GatewayRpcRequestCapture | null},
) {
	const endpoint = `${Config.gateway.rpcEndpoint}/_rpc`;

	return http.post(endpoint, async ({request}) => {
		const body = (await request.json()) as GatewayRpcRequest;
		const authorization = request.headers.get('authorization') ?? undefined;

		if (requestCapture) {
			requestCapture.current = {
				method: body.method,
				params: body.params,
				authorization,
			};
		}

		const mockResult = mockResponses.get(body.method);

		if (mockResult === undefined) {
			const errorResponse: GatewayRpcResponse = {
				error: `No mock configured for method: ${body.method}`,
			};
			return HttpResponse.json(errorResponse, {status: 500});
		}

		if (mockResult instanceof Error) {
			const errorResponse: GatewayRpcResponse = {
				error: mockResult.message,
			};
			return HttpResponse.json(errorResponse, {status: 500});
		}

		const response: GatewayRpcResponse = {
			result: mockResult,
		};

		return HttpResponse.json(response);
	});
}

export function createGatewayRpcErrorHandler(status: number, errorMessage: string) {
	const endpoint = `${Config.gateway.rpcEndpoint}/_rpc`;

	return http.post(endpoint, () => {
		const response: GatewayRpcResponse = {
			error: errorMessage,
		};
		return HttpResponse.json(response, {status});
	});
}

export function createGatewayRpcMethodErrorHandler(method: string, errorMessage: string) {
	const endpoint = `${Config.gateway.rpcEndpoint}/_rpc`;

	return http.post(endpoint, async ({request}) => {
		const body = (await request.json()) as GatewayRpcRequest;

		if (body.method === method) {
			const response: GatewayRpcResponse = {
				error: errorMessage,
			};
			return HttpResponse.json(response, {status: 500});
		}

		return HttpResponse.json({result: {}});
	});
}

export function createGatewayRpcSequenceHandler(
	method: string,
	responses: Array<{result?: unknown; error?: string; status?: number}>,
) {
	const endpoint = `${Config.gateway.rpcEndpoint}/_rpc`;
	let callCount = 0;

	return http.post(endpoint, async ({request}) => {
		const body = (await request.json()) as GatewayRpcRequest;

		if (body.method !== method) {
			return HttpResponse.json({result: {}});
		}

		const responseConfig = responses[callCount] ?? responses[responses.length - 1];
		callCount++;

		if (responseConfig.error) {
			const errorResponse: GatewayRpcResponse = {
				error: responseConfig.error,
			};
			return HttpResponse.json(errorResponse, {status: responseConfig.status ?? 500});
		}

		const response: GatewayRpcResponse = {
			result: responseConfig.result,
		};

		return HttpResponse.json(response, {status: responseConfig.status ?? 200});
	});
}
