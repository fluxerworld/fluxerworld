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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {type ApiError, parseApiResponse} from '@fluxer/admin/src/api/Errors';
import type {JsonValue} from '@fluxer/admin/src/api/JsonTypes';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig} from '@fluxer/admin/src/types/Config';
import {buildEndpointUrl, validateOutboundEndpointUrl} from '@fluxer/hono/src/security/OutboundEndpoint';

export type ApiResult<T> = {ok: true; data: T} | {ok: false; error: ApiError};
export interface RequestOptions {
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
	path: string;
	body?: JsonValue | string;
	queryParams?: Record<string, string | number | boolean | undefined | null>;
	auditLogReason?: string;
}

export class ApiClient {
	private session: Session;
	private apiEndpointUrl: URL;

	constructor(config: AdminConfig, session: Session) {
		this.session = session;
		this.apiEndpointUrl = validateOutboundEndpointUrl(config.apiEndpoint, {
			name: 'admin.apiEndpoint',
			allowHttp: config.env !== 'production',
			allowLocalhost: config.env !== 'production',
			allowPrivateIpLiterals: config.env !== 'production',
		});
	}

	private buildHeaders(auditLogReason?: string): Record<string, string> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.session.accessToken}`,
			'Content-Type': 'application/json',
		};

		if (auditLogReason) {
			headers['X-Audit-Log-Reason'] = auditLogReason;
		}

		return headers;
	}

	private buildUrl(path: string, queryParams?: Record<string, string | number | boolean | undefined | null>): string {
		const baseUrl = buildEndpointUrl(this.apiEndpointUrl, path);

		if (!queryParams) {
			return baseUrl;
		}

		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(queryParams)) {
			if (value !== undefined && value !== null && value !== '') {
				params.set(key, String(value));
			}
		}

		const queryString = params.toString();
		return queryString ? `${baseUrl}?${queryString}` : baseUrl;
	}

	async request<T>(options: RequestOptions): Promise<ApiResult<T>> {
		try {
			const url = this.buildUrl(options.path, options.queryParams);
			const headers = this.buildHeaders(options.auditLogReason);

			const fetchOptions: RequestInit = {
				method: options.method,
				headers,
			};

			if (options.body !== undefined && options.method !== 'GET') {
				if (typeof options.body === 'string') {
					fetchOptions.body = options.body;
				} else {
					fetchOptions.body = JSON.stringify(options.body);
				}
			}

			const response = await fetch(url, fetchOptions);

			if (response.status === 204) {
				return {ok: true, data: undefined as T};
			}

			if (response.ok) {
				const contentLength = response.headers.get('content-length');
				if (contentLength === '0') {
					return {ok: true, data: undefined as T};
				}

				try {
					const data = (await response.json()) as T;
					return {ok: true, data};
				} catch {
					return {ok: true, data: undefined as T};
				}
			}

			return parseApiResponse<T>(response);
		} catch (e) {
			return {
				ok: false,
				error: {type: 'networkError', message: (e as Error).message},
			};
		}
	}

	async get<T>(
		path: string,
		queryParams?: Record<string, string | number | boolean | undefined | null>,
	): Promise<ApiResult<T>> {
		return this.request<T>({
			method: 'GET',
			path,
			...(queryParams !== undefined ? {queryParams} : {}),
		});
	}

	async post<T>(path: string, body?: JsonValue | string, auditLogReason?: string): Promise<ApiResult<T>> {
		return this.request<T>({
			method: 'POST',
			path,
			...(body !== undefined ? {body} : {}),
			...(auditLogReason !== undefined ? {auditLogReason} : {}),
		});
	}

	async postVoid(path: string, body?: JsonValue | string, auditLogReason?: string): Promise<ApiResult<void>> {
		return this.request<void>({
			method: 'POST',
			path,
			...(body !== undefined ? {body} : {}),
			...(auditLogReason !== undefined ? {auditLogReason} : {}),
		});
	}

	async patch<T>(path: string, body?: JsonValue | string, auditLogReason?: string): Promise<ApiResult<T>> {
		return this.request<T>({
			method: 'PATCH',
			path,
			...(body !== undefined ? {body} : {}),
			...(auditLogReason !== undefined ? {auditLogReason} : {}),
		});
	}

	async patchVoid(path: string, body?: JsonValue | string, auditLogReason?: string): Promise<ApiResult<void>> {
		return this.request<void>({
			method: 'PATCH',
			path,
			...(body !== undefined ? {body} : {}),
			...(auditLogReason !== undefined ? {auditLogReason} : {}),
		});
	}

	async delete<T>(path: string, body?: JsonValue | string, auditLogReason?: string): Promise<ApiResult<T>> {
		return this.request<T>({
			method: 'DELETE',
			path,
			...(body !== undefined ? {body} : {}),
			...(auditLogReason !== undefined ? {auditLogReason} : {}),
		});
	}

	async deleteVoid(path: string, body?: JsonValue | string, auditLogReason?: string): Promise<ApiResult<void>> {
		return this.request<void>({
			method: 'DELETE',
			path,
			...(body !== undefined ? {body} : {}),
			...(auditLogReason !== undefined ? {auditLogReason} : {}),
		});
	}

	async put<T>(path: string, body?: JsonValue | string, auditLogReason?: string): Promise<ApiResult<T>> {
		return this.request<T>({
			method: 'PUT',
			path,
			...(body !== undefined ? {body} : {}),
			...(auditLogReason !== undefined ? {auditLogReason} : {}),
		});
	}

	async putVoid(path: string, body?: JsonValue | string, auditLogReason?: string): Promise<ApiResult<void>> {
		return this.request<void>({
			method: 'PUT',
			path,
			...(body !== undefined ? {body} : {}),
			...(auditLogReason !== undefined ? {auditLogReason} : {}),
		});
	}
}

export function createApiClient(config: AdminConfig, session: Session): ApiClient {
	return new ApiClient(config, session);
}
