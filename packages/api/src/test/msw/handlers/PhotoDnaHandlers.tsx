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

import {randomUUID} from 'node:crypto';
import {HttpResponse, http} from 'msw';

interface MatchRequestItem {
	DataRepresentation: 'Hash';
	Value: string;
}

interface MatchFlag {
	AdvancedInfo?: Array<{Key: string; Value: string}>;
	Source: string;
	Violations?: Array<string>;
	MatchDistance?: number;
}

interface MatchResponseResult {
	Status: {
		Code: number;
		Description?: string;
	};
	ContentId?: string | null;
	IsMatch: boolean;
	MatchDetails?: {
		MatchFlags?: Array<MatchFlag>;
	};
	XPartnerCustomerId?: string | null;
	TrackingId?: string | null;
}

interface MatchResponse {
	TrackingId: string;
	MatchResults: Array<MatchResponseResult>;
}

export interface PhotoDnaMockConfig {
	isMatch?: boolean;
	source?: string;
	violations?: Array<string>;
	matchDistance?: number;
	matchId?: string;
	trackingId?: string;
	statusCode?: number;
	statusDescription?: string;
}

export interface PhotoDnaRequestCapture {
	url: string;
	headers: Headers;
	body: Array<MatchRequestItem>;
}

export function createPhotoDnaMatchHandler(
	config: PhotoDnaMockConfig = {},
	requestCapture?: {current: PhotoDnaRequestCapture | null},
) {
	return http.post('https://api.microsoftmoderator.com/photodna/v1.0/Match', async ({request}) => {
		const body = (await request.json()) as Array<MatchRequestItem>;

		if (requestCapture) {
			requestCapture.current = {
				url: request.url,
				headers: request.headers,
				body,
			};
		}

		const isMatch = config.isMatch ?? false;
		const trackingId = config.trackingId ?? randomUUID();

		const matchResults: Array<MatchResponseResult> = body.map((item) => {
			const result: MatchResponseResult = {
				Status: {
					Code: config.statusCode ?? 3000,
					Description: config.statusDescription,
				},
				ContentId: item.Value,
				IsMatch: isMatch,
				TrackingId: randomUUID(),
			};

			if (isMatch) {
				const matchFlag: MatchFlag = {
					Source: config.source ?? 'mock-database',
					Violations: config.violations ?? ['CSAM'],
					MatchDistance: config.matchDistance ?? 0.01,
				};

				if (config.matchId) {
					matchFlag.AdvancedInfo = [{Key: 'MatchId', Value: config.matchId}];
				}

				result.MatchDetails = {
					MatchFlags: [matchFlag],
				};
			}

			return result;
		});

		const response: MatchResponse = {
			TrackingId: trackingId,
			MatchResults: matchResults,
		};

		return HttpResponse.json(response);
	});
}

export function createPhotoDnaErrorHandler(status: number, body?: unknown, headers?: Record<string, string>) {
	return http.post('https://api.microsoftmoderator.com/photodna/v1.0/Match', () => {
		return new HttpResponse(body != null ? JSON.stringify(body) : null, {
			status,
			headers: {
				'Content-Type': 'application/json',
				...headers,
			},
		});
	});
}

export function createPhotoDnaRateLimitHandler(retryAfterSeconds = 1) {
	return http.post('https://api.microsoftmoderator.com/photodna/v1.0/Match', () => {
		return new HttpResponse(JSON.stringify({error: 'Rate limit exceeded'}), {
			status: 429,
			headers: {
				'Retry-After': retryAfterSeconds.toString(),
			},
		});
	});
}

export function createPhotoDnaSequenceHandler(
	responses: Array<{
		isMatch?: boolean;
		source?: string;
		violations?: Array<string>;
		matchDistance?: number;
		matchId?: string;
		trackingId?: string;
		status?: number;
		error?: unknown;
	}>,
) {
	let callCount = 0;

	return http.post('https://api.microsoftmoderator.com/photodna/v1.0/Match', async ({request}) => {
		const responseConfig = responses[callCount] ?? responses[responses.length - 1];
		callCount++;

		if (responseConfig?.status && responseConfig.status >= 400) {
			return new HttpResponse(JSON.stringify(responseConfig.error ?? {error: 'Error'}), {
				status: responseConfig.status,
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}

		const body = (await request.json()) as Array<MatchRequestItem>;
		const isMatch = responseConfig?.isMatch ?? false;
		const trackingId = responseConfig?.trackingId ?? randomUUID();

		const matchResults: Array<MatchResponseResult> = body.map((item) => {
			const result: MatchResponseResult = {
				Status: {Code: 3000},
				ContentId: item.Value,
				IsMatch: isMatch,
				TrackingId: randomUUID(),
			};

			if (isMatch) {
				const matchFlag: MatchFlag = {
					Source: responseConfig?.source ?? 'mock-database',
					Violations: responseConfig?.violations ?? ['CSAM'],
					MatchDistance: responseConfig?.matchDistance ?? 0.01,
				};

				if (responseConfig?.matchId) {
					matchFlag.AdvancedInfo = [{Key: 'MatchId', Value: responseConfig.matchId}];
				}

				result.MatchDetails = {
					MatchFlags: [matchFlag],
				};
			}

			return result;
		});

		const response: MatchResponse = {
			TrackingId: trackingId,
			MatchResults: matchResults,
		};

		return HttpResponse.json(response);
	});
}
