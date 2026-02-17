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

import {createHttpClient} from '@fluxer/http_client/src/HttpClient';
import type {HttpClient, RequestOptions, StreamResponse} from '@fluxer/http_client/src/HttpClientTypes';
import {createPublicInternetRequestUrlPolicy} from '@fluxer/http_client/src/PublicInternetRequestUrlPolicy';

const requestUrlPolicy = createPublicInternetRequestUrlPolicy();
const client: HttpClient = createHttpClient({
	userAgent: 'fluxer-api',
	requestUrlPolicy,
});
const redirectScopedClients = new Map<number, HttpClient>();

interface SendRequestOptions {
	maxRedirects?: number;
}

function getHttpClientForRequest(options?: SendRequestOptions): HttpClient {
	if (!options?.maxRedirects) {
		return client;
	}

	const existingClient = redirectScopedClients.get(options.maxRedirects);
	if (existingClient) {
		return existingClient;
	}

	const redirectScopedClient = createHttpClient({
		userAgent: 'fluxer-api',
		maxRedirects: options.maxRedirects,
		requestUrlPolicy,
	});
	redirectScopedClients.set(options.maxRedirects, redirectScopedClient);
	return redirectScopedClient;
}

export async function sendRequest(opts: RequestOptions, options?: SendRequestOptions) {
	const requestClient = getHttpClientForRequest(options);
	return requestClient.sendRequest(opts);
}

export function streamToString(stream: StreamResponse['stream']) {
	return client.streamToString(stream);
}
