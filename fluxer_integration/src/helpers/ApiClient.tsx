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

import {Config} from '@fluxer/integration/Config';

export interface ApiResponse<T> {
	status: number;
	data: T;
	ok: boolean;
}

export class ApiClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor() {
		this.baseUrl = Config.apiUrl;
		this.headers = {
			'Content-Type': 'application/json',
			'User-Agent': 'FluxerIntegrationTests/1.0',
			'X-Forwarded-For': '127.0.0.1',
		};
		if (Config.testToken) {
			this.headers['X-Test-Token'] = Config.testToken;
		}
		if (Config.webAppOrigin) {
			this.headers['Origin'] = Config.webAppOrigin;
		}
	}

	private async request<T>(method: string, path: string, body?: unknown, token?: string): Promise<ApiResponse<T>> {
		const headers = {...this.headers};
		if (token) {
			headers['Authorization'] = token;
		}

		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});

		const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;

		return {
			status: response.status,
			data: data as T,
			ok: response.ok,
		};
	}

	async get<T>(path: string, token?: string): Promise<ApiResponse<T>> {
		return this.request<T>('GET', path, undefined, token);
	}

	async post<T>(path: string, body: unknown, token?: string): Promise<ApiResponse<T>> {
		return this.request<T>('POST', path, body, token);
	}

	async patch<T>(path: string, body: unknown, token?: string): Promise<ApiResponse<T>> {
		return this.request<T>('PATCH', path, body, token);
	}

	async delete<T>(path: string, token?: string): Promise<ApiResponse<T>> {
		return this.request<T>('DELETE', path, undefined, token);
	}
}

export const apiClient = new ApiClient();
