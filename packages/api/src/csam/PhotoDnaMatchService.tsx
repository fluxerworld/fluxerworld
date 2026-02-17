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
import type {PhotoDnaMatchDetail, PhotoDnaMatchResult} from '@fluxer/api/src/csam/CsamTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {
	recordCsamMatch,
	recordPhotoDnaApiCall,
	recordPhotoDnaApiDuration,
} from '@fluxer/api/src/telemetry/CsamTelemetry';
import {ms} from 'itty-time';

interface MatchRequestItem {
	DataRepresentation: 'Hash';
	Value: string;
}

interface MatchResponseResult {
	Status: {
		Code: number;
		Description?: string;
	};
	ContentId?: string | null;
	IsMatch: boolean;
	MatchDetails?: {
		MatchFlags?: Array<{
			AdvancedInfo?: Array<{Key: string; Value: string}>;
			Source: string;
			Violations?: Array<string>;
			MatchDistance?: number;
		}>;
	};
	XPartnerCustomerId?: string | null;
	TrackingId?: string | null;
}

interface MatchResponse {
	TrackingId: string;
	MatchResults: Array<MatchResponseResult>;
}

export class PhotoDnaMatchService {
	private readonly minIntervalMs = Math.floor(1000 / Math.max(Config.photoDna.rateLimit.requestsPerSecond, 1));
	private requestChain: Promise<unknown> = Promise.resolve();
	private nextAvailableTimestamp = Date.now();
	private readonly subscriptionKey: string;

	constructor() {
		if (!Config.photoDna.enabled) {
			throw new Error('PhotoDNA match service initialized while the feature is disabled');
		}

		const subscriptionKey = Config.photoDna.api.subscriptionKey;
		if (!subscriptionKey) {
			throw new Error('PhotoDNA subscription key is not configured');
		}

		this.subscriptionKey = subscriptionKey;
	}

	async matchHashes(hashes: Array<string>): Promise<PhotoDnaMatchResult> {
		const normalized = hashes.filter((hash) => typeof hash === 'string' && hash.trim().length > 0);
		if (normalized.length === 0) {
			return {
				isMatch: false,
				trackingId: '',
				matchDetails: [],
				timestamp: new Date().toISOString(),
			};
		}

		const aggregated: Array<PhotoDnaMatchDetail> = [];
		let trackingId = '';
		let isMatch = false;

		const chunks = this.chunkArray(normalized, 5);
		for (const chunk of chunks) {
			const response = await this.schedule(() => this.callMatchApi(chunk));
			if (!response) {
				continue;
			}

			trackingId = response.TrackingId || trackingId;
			for (const result of response.MatchResults ?? []) {
				if (result.IsMatch) {
					isMatch = true;
				}

				const flags = result.MatchDetails?.MatchFlags ?? [];
				for (const flag of flags) {
					const matchId = flag.AdvancedInfo?.find((info) => info.Key === 'MatchId')?.Value;
					aggregated.push({
						source: flag.Source,
						violations: flag.Violations ?? [],
						matchDistance: flag.MatchDistance ?? 0,
						matchId,
					});
				}
			}
		}

		if (isMatch && aggregated.length > 0) {
			const source = aggregated[0]?.source ?? 'unknown';
			recordCsamMatch({
				resourceType: 'other',
				source,
				matchCount: aggregated.length,
			});
		}

		return {
			isMatch,
			trackingId,
			matchDetails: aggregated,
			timestamp: new Date().toISOString(),
		};
	}

	private async callMatchApi(chunk: Array<string>): Promise<MatchResponse | null> {
		const startTime = Date.now();
		const url = new URL(Config.photoDna.api.endpoint);
		url.searchParams.set('enhance', Config.photoDna.api.enhance ? 'true' : 'false');

		const body = chunk.map<MatchRequestItem>((hash) => ({
			DataRepresentation: 'Hash',
			Value: hash,
		}));

		const response = await fetch(url.toString(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Ocp-Apim-Subscription-Key': this.subscriptionKey,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(ms('30 seconds')),
		});

		const durationMs = Date.now() - startTime;

		if (!response.ok) {
			const details = await response.text().catch(() => '<no details>');
			Logger.warn(
				{
					status: response.status,
					url: url.toString(),
					body: details,
				},
				'PhotoDNA match request failed',
			);
			recordPhotoDnaApiCall({
				operation: 'match',
				status: 'error',
				hashCount: chunk.length,
			});
			recordPhotoDnaApiDuration({
				operation: 'match',
				durationMs,
			});
			return null;
		}

		recordPhotoDnaApiCall({
			operation: 'match',
			status: 'success',
			hashCount: chunk.length,
		});
		recordPhotoDnaApiDuration({
			operation: 'match',
			durationMs,
		});

		return (await response.json()) as MatchResponse;
	}

	private async schedule<T>(fn: () => Promise<T>): Promise<T> {
		const scheduled = this.requestChain.then(async () => {
			const now = Date.now();
			const wait = Math.max(0, this.nextAvailableTimestamp - now);
			if (wait > 0) {
				await new Promise((resolve) => setTimeout(resolve, wait));
			}
			this.nextAvailableTimestamp = Math.max(this.nextAvailableTimestamp, Date.now()) + this.minIntervalMs;
			return fn();
		});
		this.requestChain = scheduled.catch(() => {});
		return scheduled;
	}

	private chunkArray<T>(values: Array<T>, size: number): Array<Array<T>> {
		const chunks: Array<Array<T>> = [];
		for (let i = 0; i < values.length; i += size) {
			chunks.push(values.slice(i, i + size));
		}
		return chunks;
	}
}
