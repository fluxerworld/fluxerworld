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

import {createHttpClient as createHttpClientCore} from '@fluxer/http_client/src/HttpClient';
import type {HttpClient, RequestOptions, StreamResponse} from '@fluxer/http_client/src/HttpClientTypes';
import {HttpError as CoreHttpError} from '@fluxer/http_client/src/HttpError';
import {createPublicInternetRequestUrlPolicy} from '@fluxer/http_client/src/PublicInternetRequestUrlPolicy';
import type {ErrorType} from '@fluxer/media_proxy/src/types/HonoEnv';
import type {MetricsInterface} from '@fluxer/media_proxy/src/types/Metrics';
import type {TracingInterface} from '@fluxer/media_proxy/src/types/Tracing';

export class HttpError extends Error {
	constructor(
		message: string,
		public readonly status?: number,
		public readonly response?: Response,
		public readonly isExpected = false,
		public readonly errorType?: ErrorType,
	) {
		super(message);
		this.name = 'HttpError';
	}
}

function convertHttpError(err: unknown): never {
	if (err instanceof CoreHttpError && err instanceof Error) {
		throw new HttpError(
			err.message,
			err.status,
			err.response,
			err.isExpected,
			(err.errorType as ErrorType) ?? undefined,
		);
	}
	throw err;
}

export function createHttpClient(
	userAgent: string,
	options?: {metrics?: MetricsInterface | undefined; tracing?: TracingInterface | undefined},
): HttpClient {
	const {metrics, tracing} = options ?? {};

	const coreClient: HttpClient = createHttpClientCore({
		userAgent,
		requestUrlPolicy: createPublicInternetRequestUrlPolicy(),
		telemetry: {
			metrics: metrics
				? {
						counter: (params) => {
							const newName = params.name.replace('http_client', 'media_proxy.origin');
							metrics.counter({...params, name: newName});
						},
						histogram: (params) => {
							const newName = params.name.replace('http_client', 'media_proxy.origin');
							metrics.histogram({...params, name: newName});
						},
					}
				: undefined,
			tracing: tracing
				? {
						withSpan: (spanOpts, fn) =>
							tracing.withSpan(
								{
									name: spanOpts.name.replace('http_client.fetch', 'origin.fetch'),
									attributes: spanOpts.attributes as Record<string, string | number | boolean | undefined>,
								},
								fn,
							),
					}
				: undefined,
		},
	});

	async function sendRequest(opts: RequestOptions): Promise<StreamResponse> {
		try {
			const result = await coreClient.sendRequest(opts);
			const contentLength = result.headers.get('content-length');
			if (contentLength && metrics) {
				const bytes = Number.parseInt(contentLength, 10);
				if (!Number.isNaN(bytes)) {
					metrics.counter({
						name: 'media_proxy.origin.bytes',
						dimensions: {method: opts.method ?? 'GET'},
						value: bytes,
					});
				}
			}
			return result;
		} catch (error) {
			convertHttpError(error);
		}
	}

	return {
		request: sendRequest,
		sendRequest,
		streamToString: coreClient.streamToString,
	};
}
