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
import type {CsamScanQueueEntry, CsamScanResultMessage, PhotoDnaMatchResult} from '@fluxer/api/src/csam/CsamTypes';
import {PhotoDnaMatchService} from '@fluxer/api/src/csam/PhotoDnaMatchService';
import {Logger} from '@fluxer/api/src/Logger';
import {recordCsamQueueDepth, recordCsamQueueProcessed} from '@fluxer/api/src/telemetry/CsamTelemetry';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';

const LOCK_KEY = 'csam:scan:consumer:lock';
const LOCK_TTL_SECONDS = 5;
const QUEUE_KEY = 'csam:scan:queue';
const BATCH_SIZE = 5;

const csamScanConsumer: WorkerTaskHandler = async (_payload, _helpers) => {
	const deps = getWorkerDependencies();
	const kvProvider = deps.kvClient;
	const cacheService = deps.cacheService;

	const lockToken = await cacheService.acquireLock(LOCK_KEY, LOCK_TTL_SECONDS);
	if (!lockToken) {
		return;
	}

	const entries: Array<CsamScanQueueEntry> = [];
	try {
		const rawEntries = await kvProvider.lpop(QUEUE_KEY, BATCH_SIZE);
		for (const raw of rawEntries) {
			try {
				entries.push(JSON.parse(raw) as CsamScanQueueEntry);
			} catch {
				Logger.warn({raw}, 'Failed to parse CSAM scan queue entry');
			}
		}

		if (entries.length === 0) {
			return;
		}

		const queueDepth = await kvProvider.llen(QUEUE_KEY);
		recordCsamQueueDepth({depth: queueDepth});

		if (!Config.photoDna.enabled) {
			for (const entry of entries) {
				const result: CsamScanResultMessage = {isMatch: false};
				await kvProvider.publish(`csam:result:${entry.requestId}`, JSON.stringify(result));
			}
			recordCsamQueueProcessed({status: 'success', batchSize: entries.length});
			return;
		}

		const hashToRequest = new Map<string, {requestId: string; entry: CsamScanQueueEntry}>();
		const allHashes: Array<string> = [];

		for (const entry of entries) {
			for (const hash of entry.hashes) {
				hashToRequest.set(hash, {requestId: entry.requestId, entry});
				allHashes.push(hash);
			}
		}

		if (allHashes.length === 0) {
			for (const entry of entries) {
				const result: CsamScanResultMessage = {isMatch: false};
				await kvProvider.publish(`csam:result:${entry.requestId}`, JSON.stringify(result));
			}
			recordCsamQueueProcessed({status: 'success', batchSize: entries.length});
			return;
		}

		let matchResult: PhotoDnaMatchResult;
		try {
			const matchService = new PhotoDnaMatchService();
			matchResult = await matchService.matchHashes(allHashes);
		} catch (error) {
			Logger.error({error}, 'PhotoDNA match service failed');
			for (const entry of entries) {
				const result: CsamScanResultMessage = {
					isMatch: false,
					error: 'PhotoDNA service error',
				};
				await kvProvider.publish(`csam:result:${entry.requestId}`, JSON.stringify(result));
			}
			recordCsamQueueProcessed({status: 'error', batchSize: entries.length});
			return;
		}

		for (const entry of entries) {
			const result: CsamScanResultMessage = {
				isMatch: matchResult.isMatch,
				matchResult: matchResult.isMatch ? matchResult : undefined,
			};
			await kvProvider.publish(`csam:result:${entry.requestId}`, JSON.stringify(result));
		}
		recordCsamQueueProcessed({status: 'success', batchSize: entries.length});
	} catch (error) {
		Logger.error({error}, 'CSAM scan consumer failed');
		const entriesCount = entries.length;
		if (entriesCount > 0) {
			recordCsamQueueProcessed({status: 'error', batchSize: entriesCount});
		}
		throw error;
	} finally {
		await cacheService.releaseLock(LOCK_KEY, lockToken);
	}
};

export default csamScanConsumer;
