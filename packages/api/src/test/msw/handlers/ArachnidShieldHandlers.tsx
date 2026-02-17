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

import {HttpResponse, http} from 'msw';

export interface ArachnidShieldResponse {
	classification: 'no-known-match' | 'csam' | 'harmful-abusive-material' | 'test';
	sha256_hex: string;
	sha1_base32: string;
	match_type: 'exact' | 'near' | null;
	size_bytes: number;
	match_id?: string;
	near_match_details?: Array<{
		classification: string;
		sha1_base32: string;
		sha256_hex: string;
		timestamp: number;
	}>;
}

export interface ArachnidShieldMockConfig {
	classification?: ArachnidShieldResponse['classification'];
	sha256Hex?: string;
	sha1Base32?: string;
	matchType?: ArachnidShieldResponse['match_type'];
	sizeBytes?: number;
	matchId?: string;
	nearMatchDetails?: ArachnidShieldResponse['near_match_details'];
}

export interface ArachnidShieldRequestCapture {
	headers: Headers;
	body: ArrayBuffer;
	url: string;
}

export function createArachnidShieldHandler(
	config: ArachnidShieldMockConfig = {},
	requestCapture?: {current: ArachnidShieldRequestCapture | null},
) {
	return http.post('https://shield.projectarachnid.com/v1/media', async ({request}) => {
		if (requestCapture) {
			requestCapture.current = {
				headers: request.headers,
				body: await request.clone().arrayBuffer(),
				url: request.url,
			};
		}

		const response: ArachnidShieldResponse = {
			classification: config.classification ?? 'no-known-match',
			sha256_hex: config.sha256Hex ?? 'abc123def456',
			sha1_base32: config.sha1Base32 ?? 'test-sha1',
			match_type: config.matchType ?? null,
			size_bytes: config.sizeBytes ?? 1024,
		};

		if (config.matchId) {
			response.match_id = config.matchId;
		}

		if (config.nearMatchDetails) {
			response.near_match_details = config.nearMatchDetails;
		}

		return HttpResponse.json(response);
	});
}

export function createArachnidShieldErrorHandler(status: number, body?: unknown, headers?: Record<string, string>) {
	return http.post('https://shield.projectarachnid.com/v1/media', () => {
		return new HttpResponse(body != null ? JSON.stringify(body) : null, {
			status,
			headers: {
				'Content-Type': 'application/json',
				...headers,
			},
		});
	});
}

export function createArachnidShieldRateLimitHandler(resetSeconds = 1) {
	return http.post('https://shield.projectarachnid.com/v1/media', () => {
		return new HttpResponse(null, {
			status: 429,
			headers: {
				ratelimit: `"burst";r=0;t=${resetSeconds}`,
			},
		});
	});
}

export function createArachnidShieldSequenceHandler(
	responses: Array<{
		status?: number;
		body?: ArachnidShieldResponse | unknown;
		headers?: Record<string, string>;
	}>,
) {
	let callCount = 0;

	return http.post('https://shield.projectarachnid.com/v1/media', () => {
		const responseConfig = responses[callCount] ?? responses[responses.length - 1];
		callCount++;

		const status = responseConfig?.status ?? 200;
		const body = responseConfig?.body;
		const headers = responseConfig?.headers ?? {};

		if (status >= 200 && status < 300 && body != null) {
			return HttpResponse.json(body, {status, headers});
		}

		return new HttpResponse(body != null ? JSON.stringify(body) : null, {
			status,
			headers: {
				'Content-Type': 'application/json',
				...headers,
			},
		});
	});
}
