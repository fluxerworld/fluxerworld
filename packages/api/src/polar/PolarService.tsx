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

/**
 * Thin HTTP client for the Polar REST API. Used by Polar{Checkout,Gift,
 * Premium,Subscription,Webhook}Service. Kept intentionally small: no
 * SDK wrapper, no retries, no caching — services handle domain logic.
 *
 * Auth: Organization Access Token ("polar_oat_…") set on
 * `integrations.polar.api_key` in config.
 *
 * Base URL: `api.polar.sh/v1` in prod, `sandbox-api.polar.sh/v1` in sandbox.
 */
export class PolarService {
	private readonly baseUrl: string;
	private readonly apiKey: string;

	constructor() {
		const polar = Config.polar;
		if (!polar || !polar.apiKey) {
			throw new Error('Polar is enabled but Config.polar.apiKey is not configured');
		}
		this.apiKey = polar.apiKey;
		this.baseUrl = polar.sandbox
			? 'https://sandbox-api.polar.sh/v1'
			: 'https://api.polar.sh/v1';
	}

	async request<T>(
		method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
		path: string,
		body?: unknown,
	): Promise<T> {
		const url = `${this.baseUrl}${path}`;
		const res = await fetch(url, {
			method,
			headers: {
				'Authorization': `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new Error(`Polar API ${method} ${path} failed: ${res.status} ${text}`);
		}
		// Some DELETEs return 204 No Content
		if (res.status === 204) return undefined as T;
		return (await res.json()) as T;
	}
}
