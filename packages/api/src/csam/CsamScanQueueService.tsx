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
import type {CsamResourceType, PhotoDnaMatchResult} from '@fluxer/api/src/csam/CsamTypes';
import type {ILogger} from '@fluxer/api/src/ILogger';
import {recordCsamQueueWaitTime} from '@fluxer/api/src/telemetry/CsamTelemetry';
import {DEFAULT_CSAM_SCAN_TIMEOUT_MS} from '@fluxer/constants/src/Timeouts';
import {
	CsamScanFailedError,
	CsamScanParseError,
	CsamScanSubscriptionError,
	CsamScanTimeoutError,
} from '@fluxer/errors/src/domains/csam/CsamScanErrors';
import type {IKVProvider, IKVSubscription} from '@fluxer/kv_client/src/IKVProvider';

const CSAM_SCAN_QUEUE_KEY = 'csam:scan:queue';

export interface CsamScanQueueServiceOptions {
	kvProvider: IKVProvider;
	logger: ILogger;
	timeoutMs?: number;
}

export interface CsamScanContext {
	resourceType: CsamResourceType;
	userId: string | null;
	guildId: string | null;
	channelId: string | null;
	messageId: string | null;
}

export interface CsamScanSubmitParams {
	hashes: Array<string>;
	context: CsamScanContext;
	timeoutMs?: number;
}

export interface CsamScanQueueResult {
	isMatch: boolean;
	matchResult?: PhotoDnaMatchResult;
}

export interface CsamScanQueueEntry {
	requestId: string;
	hashes: Array<string>;
	timestamp: number;
	context: CsamScanContext;
}

interface CsamScanResultMessage {
	isMatch: boolean;
	matchResult?: PhotoDnaMatchResult;
	error?: string;
}

export interface ICsamScanQueueService {
	submitScan(params: CsamScanSubmitParams): Promise<CsamScanQueueResult>;
}

export class CsamScanQueueService implements ICsamScanQueueService {
	private kvProvider: IKVProvider;
	private logger: ILogger;
	private defaultTimeoutMs: number;

	constructor(options: CsamScanQueueServiceOptions) {
		this.kvProvider = options.kvProvider;
		this.logger = options.logger;
		this.defaultTimeoutMs = options.timeoutMs ?? DEFAULT_CSAM_SCAN_TIMEOUT_MS;
	}

	async submitScan(params: CsamScanSubmitParams): Promise<CsamScanQueueResult> {
		const requestId = randomUUID();
		const timeoutMs = params.timeoutMs ?? this.defaultTimeoutMs;
		const resultChannel = `csam:result:${requestId}`;

		const queueEntry: CsamScanQueueEntry = {
			requestId,
			hashes: params.hashes,
			timestamp: Date.now(),
			context: params.context,
		};

		let subscription: IKVSubscription | null = null;

		try {
			subscription = this.kvProvider.duplicate();
			await subscription.connect();
			await subscription.subscribe(resultChannel);

			const resultPromise = new Promise<CsamScanQueueResult>((resolve, reject) => {
				let timeoutId: NodeJS.Timeout | null = null;

				const cleanup = () => {
					if (timeoutId) {
						clearTimeout(timeoutId);
						timeoutId = null;
					}
				};

				timeoutId = setTimeout(() => {
					cleanup();
					const waitTimeMs = Date.now() - queueEntry.timestamp;
					recordCsamQueueWaitTime({waitTimeMs});
					reject(new CsamScanTimeoutError());
				}, timeoutMs);

				subscription!.on('message', (_channel, message) => {
					cleanup();
					try {
						const result = JSON.parse(message) as CsamScanResultMessage;
						const waitTimeMs = Date.now() - queueEntry.timestamp;
						recordCsamQueueWaitTime({waitTimeMs});
						if (result.error) {
							reject(new CsamScanFailedError());
							return;
						}
						resolve({
							isMatch: result.isMatch,
							matchResult: result.matchResult,
						});
					} catch (_parseError) {
						const waitTimeMs = Date.now() - queueEntry.timestamp;
						recordCsamQueueWaitTime({waitTimeMs});
						reject(new CsamScanParseError());
					}
				});

				subscription!.on('error', (error) => {
					cleanup();
					const waitTimeMs = Date.now() - queueEntry.timestamp;
					recordCsamQueueWaitTime({waitTimeMs});
					this.logger.error({error, requestId}, 'CSAM scan subscription error');
					reject(new CsamScanSubscriptionError());
				});
			});

			await this.kvProvider.rpush(CSAM_SCAN_QUEUE_KEY, JSON.stringify(queueEntry));

			this.logger.debug({requestId, hashCount: params.hashes.length}, 'Submitted CSAM scan request');

			return await resultPromise;
		} finally {
			if (subscription) {
				try {
					subscription.removeAllListeners('message');
					subscription.removeAllListeners('error');
					await subscription.quit();
				} catch (cleanupError) {
					this.logger.error({error: cleanupError, requestId}, 'Failed to cleanup CSAM scan subscription');
				}
			}
		}
	}
}
