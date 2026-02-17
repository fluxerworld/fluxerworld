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

const BLOCKED_PROXY_REQUEST_HEADERS = [
	'authorization',
	'connection',
	'cookie',
	'host',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailer',
	'trailers',
	'transfer-encoding',
	'upgrade',
] as const;

const BLOCKED_PROXY_RESPONSE_HEADERS = [
	'connection',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailer',
	'trailers',
	'transfer-encoding',
	'upgrade',
] as const;

interface NodeFetchRequestInit extends RequestInit {
	duplex?: 'half';
}

export interface CreateProxyRequestHeadersOptions {
	incomingHeaders: Headers;
	upstreamHost: string;
}

export interface ForwardProxyRequestOptions {
	targetUrl: URL;
	method: string;
	headers: Headers;
	body?: Request['body'];
	bufferResponseBody?: boolean;
}

export function createProxyRequestHeaders(options: CreateProxyRequestHeadersOptions): Headers {
	const headers = new Headers(options.incomingHeaders);

	for (const headerName of BLOCKED_PROXY_REQUEST_HEADERS) {
		headers.delete(headerName);
	}

	headers.set('host', options.upstreamHost);
	return headers;
}

export async function forwardProxyRequest(options: ForwardProxyRequestOptions): Promise<Response> {
	const {targetUrl, method, headers, body, bufferResponseBody = false} = options;
	const requestInit: NodeFetchRequestInit = {method, headers};

	if (method !== 'GET' && method !== 'HEAD' && body !== null && body !== undefined) {
		requestInit.body = body;
		requestInit.duplex = 'half';
	}

	const upstreamResponse = await fetch(targetUrl.toString(), requestInit);

	const responseHeaders = new Headers(upstreamResponse.headers);
	for (const headerName of BLOCKED_PROXY_RESPONSE_HEADERS) {
		responseHeaders.delete(headerName);
	}

	responseHeaders.delete('content-length');
	responseHeaders.delete('content-encoding');

	if (bufferResponseBody) {
		const bodyBuffer = new Uint8Array(await upstreamResponse.arrayBuffer());
		return new Response(bodyBuffer, {
			status: upstreamResponse.status,
			headers: responseHeaders,
		});
	}

	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		headers: responseHeaders,
	});
}
