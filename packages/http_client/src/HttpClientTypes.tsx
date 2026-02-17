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

import type {HttpClientTelemetry} from '@fluxer/http_client/src/HttpClientTelemetryTypes';

export type ResponseStream = ReadableStream<Uint8Array> | null;

export type HttpMethod = 'GET' | 'POST' | 'HEAD' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export type RequestUrlValidationPhase = 'initial' | 'redirect';

export interface RequestUrlValidationContext {
	phase: RequestUrlValidationPhase;
	redirectCount: number;
	previousUrl?: string;
}

export interface RequestUrlPolicy {
	validate(url: URL, context: RequestUrlValidationContext): Promise<void>;
}

export interface RequestOptions {
	url: string;
	method?: HttpMethod;
	headers?: Record<string, string>;
	body?: unknown;
	signal?: AbortSignal;
	timeout?: number;
	serviceName?: string;
}

export interface StreamResponse {
	stream: ResponseStream;
	headers: Headers;
	status: number;
	url: string;
}

export interface HttpClient {
	request(opts: RequestOptions): Promise<StreamResponse>;
	sendRequest(opts: RequestOptions): Promise<StreamResponse>;
	streamToString(stream: ResponseStream): Promise<string>;
}

export interface HttpClientFactoryOptions {
	userAgent: string;
	telemetry?: HttpClientTelemetry;
	defaultHeaders?: Record<string, string>;
	defaultTimeoutMs?: number;
	maxRedirects?: number;
	requestUrlPolicy?: RequestUrlPolicy;
}
