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
import {Config} from '@fluxer/api/src/Config';
import type {CsamScanQueueEntry, CsamScanResultMessage} from '@fluxer/api/src/csam/CsamTypes';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {
	createPhotoDnaErrorHandler,
	createPhotoDnaMatchHandler,
} from '@fluxer/api/src/test/msw/handlers/PhotoDnaHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {clearWorkerDependencies, setWorkerDependenciesForTest} from '@fluxer/api/src/worker/WorkerContext';
import {KVCacheProvider} from '@fluxer/cache/src/providers/KVCacheProvider';
import type {WorkerTaskHandler, WorkerTaskHelpers} from '@fluxer/worker/src/contracts/WorkerTask';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi} from 'vitest';

const LOCK_KEY = 'csam:scan:consumer:lock';
const LOCK_TTL_SECONDS = 5;
const QUEUE_KEY = 'csam:scan:queue';

function createQueueEntry(overrides: Partial<CsamScanQueueEntry> = {}): CsamScanQueueEntry {
	return {
		requestId: randomUUID(),
		hashes: [`hash-${randomUUID()}`],
		...overrides,
	};
}

describe('CsamScanConsumerWorker', () => {
	let harness: ApiTestHarness;
	let cacheService: KVCacheProvider;
	let csamScanConsumer: WorkerTaskHandler;
	let mockHelpers: WorkerTaskHelpers;
	let publishSpy: MockInstance;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
		vi.clearAllMocks();

		cacheService = new KVCacheProvider({client: harness.kvProvider});

		setWorkerDependenciesForTest({
			kvClient: harness.kvProvider,
			cacheService,
		});

		publishSpy = vi.spyOn(harness.kvProvider, 'publish');

		mockHelpers = {
			logger: {
				trace: vi.fn(),
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				child: () => mockHelpers.logger,
			},
			addJob: vi.fn(async () => {}),
		};

		const module = await import('@fluxer/api/src/worker/tasks/CsamScanConsumerWorker');
		csamScanConsumer = module.default;
	});

	afterEach(() => {
		clearWorkerDependencies();
		vi.clearAllMocks();
	});

	describe('lock acquisition', () => {
		it('acquires lock before processing with correct key and TTL', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const acquireLockSpy = vi.spyOn(cacheService, 'acquireLock');

			await csamScanConsumer({}, mockHelpers);

			expect(acquireLockSpy).toHaveBeenCalledTimes(1);
			expect(acquireLockSpy).toHaveBeenCalledWith(LOCK_KEY, LOCK_TTL_SECONDS);
		});

		it('processes queue entries only when lock is acquired', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const entries = [createQueueEntry(), createQueueEntry()];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('lock not acquired', () => {
		it('skips processing when lock cannot be acquired', async () => {
			const entries = [createQueueEntry()];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			const lockToken = await cacheService.acquireLock(LOCK_KEY, 60);
			expect(lockToken).not.toBeNull();

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).not.toHaveBeenCalled();

			const queueLength = await harness.kvProvider.llen(QUEUE_KEY);
			expect(queueLength).toBe(1);

			await cacheService.releaseLock(LOCK_KEY, lockToken!);
		});
	});

	describe('batch processing', () => {
		it('processes multiple queue entries in a single batch', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const entries = [
				createQueueEntry({requestId: 'request-1'}),
				createQueueEntry({requestId: 'request-2'}),
				createQueueEntry({requestId: 'request-3'}),
			];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(3);

			const publishedChannels = publishSpy.mock.calls.map((call) => call[0]);
			expect(publishedChannels).toContain('csam:result:request-1');
			expect(publishedChannels).toContain('csam:result:request-2');
			expect(publishedChannels).toContain('csam:result:request-3');
		});

		it('respects batch size limit of 5 entries', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const entries = Array.from({length: 10}, (_, i) => createQueueEntry({requestId: `request-${i}`}));
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(5);

			const remainingQueueLength = await harness.kvProvider.llen(QUEUE_KEY);
			expect(remainingQueueLength).toBe(5);
		});
	});

	describe('result publishing', () => {
		it('publishes results to correct channels with format csam:result:{requestId}', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const entries = [createQueueEntry({requestId: 'test-request-123'})];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(1);
			expect(publishSpy).toHaveBeenCalledWith('csam:result:test-request-123', expect.any(String));
		});

		it('publishes result message with correct format', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const entries = [createQueueEntry()];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(1);
			const publishedMessage = publishSpy.mock.calls[0]![1];
			const result = JSON.parse(publishedMessage) as CsamScanResultMessage;
			expect(result).toHaveProperty('isMatch');
			expect(typeof result.isMatch).toBe('boolean');
		});
	});

	describe('empty queue handling', () => {
		it('handles empty queue gracefully without errors', async () => {
			const releaseLockSpy = vi.spyOn(cacheService, 'releaseLock');

			await expect(csamScanConsumer({}, mockHelpers)).resolves.not.toThrow();

			expect(publishSpy).not.toHaveBeenCalled();
			expect(releaseLockSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('PhotoDNA disabled', () => {
		it('publishes isMatch: false for all requests when PhotoDNA is disabled', async () => {
			const configSpy = vi.spyOn(Config.photoDna, 'enabled', 'get').mockReturnValue(false);

			const entries = [
				createQueueEntry({requestId: 'disabled-request-1'}),
				createQueueEntry({requestId: 'disabled-request-2'}),
			];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(2);

			for (const call of publishSpy.mock.calls) {
				const result = JSON.parse(call[1]) as CsamScanResultMessage;
				expect(result.isMatch).toBe(false);
			}

			configSpy.mockRestore();
		});
	});

	describe('PhotoDNA API errors', () => {
		it('publishes isMatch: false when PhotoDNA API returns HTTP error', async () => {
			server.use(createPhotoDnaErrorHandler(500, {error: 'Internal server error'}));

			const entries = [
				createQueueEntry({requestId: 'error-request-1'}),
				createQueueEntry({requestId: 'error-request-2'}),
			];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}
			const releaseLockSpy = vi.spyOn(cacheService, 'releaseLock');

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(2);

			for (const call of publishSpy.mock.calls) {
				const result = JSON.parse(call[1]) as CsamScanResultMessage;
				expect(result.isMatch).toBe(false);
				expect(result.error).toBeUndefined();
			}

			expect(releaseLockSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe('lock release', () => {
		it('releases lock after successful processing', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const entries = [createQueueEntry()];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}
			const releaseLockSpy = vi.spyOn(cacheService, 'releaseLock');

			await csamScanConsumer({}, mockHelpers);

			expect(releaseLockSpy).toHaveBeenCalledTimes(1);
			expect(releaseLockSpy).toHaveBeenCalledWith(LOCK_KEY, expect.any(String));
		});

		it('releases lock after empty queue processing', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const releaseLockSpy = vi.spyOn(cacheService, 'releaseLock');

			await csamScanConsumer({}, mockHelpers);

			expect(releaseLockSpy).toHaveBeenCalledTimes(1);
		});

		it('releases lock even when PhotoDNA API returns HTTP error', async () => {
			server.use(createPhotoDnaErrorHandler(500, {error: 'Internal server error'}));

			const entries = [createQueueEntry()];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}
			const releaseLockSpy = vi.spyOn(cacheService, 'releaseLock');

			await csamScanConsumer({}, mockHelpers);

			expect(releaseLockSpy).toHaveBeenCalledTimes(1);
		});

		it('releases lock when PhotoDNA is disabled', async () => {
			const configSpy = vi.spyOn(Config.photoDna, 'enabled', 'get').mockReturnValue(false);

			const entries = [createQueueEntry()];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}
			const releaseLockSpy = vi.spyOn(cacheService, 'releaseLock');

			await csamScanConsumer({}, mockHelpers);

			expect(releaseLockSpy).toHaveBeenCalledTimes(1);

			configSpy.mockRestore();
		});
	});

	describe('match detection', () => {
		it('publishes isMatch: true with matchResult when PhotoDNA detects match', async () => {
			server.use(
				createPhotoDnaMatchHandler({
					isMatch: true,
					matchId: 'test-match-id',
					source: 'test-database',
					violations: ['CSAM'],
					matchDistance: 0.01,
				}),
			);

			const entries = [createQueueEntry()];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(1);
			const publishedMessage = publishSpy.mock.calls[0]![1];
			const result = JSON.parse(publishedMessage) as CsamScanResultMessage;
			expect(result.isMatch).toBe(true);
			expect(result.matchResult).toBeDefined();
			expect(result.matchResult!.isMatch).toBe(true);
		});

		it('publishes isMatch: false without matchResult when PhotoDNA finds no match', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));

			const entries = [createQueueEntry()];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(1);
			const publishedMessage = publishSpy.mock.calls[0]![1];
			const result = JSON.parse(publishedMessage) as CsamScanResultMessage;
			expect(result.isMatch).toBe(false);
			expect(result.matchResult).toBeUndefined();
		});
	});

	describe('entries with empty hashes', () => {
		it('publishes isMatch: false when entries have no hashes', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			const entries = [createQueueEntry({hashes: []}), createQueueEntry({hashes: []})];
			for (const entry of entries) {
				await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(entry));
			}

			await csamScanConsumer({}, mockHelpers);

			expect(publishSpy).toHaveBeenCalledTimes(2);
			for (const call of publishSpy.mock.calls) {
				const result = JSON.parse(call[1]) as CsamScanResultMessage;
				expect(result.isMatch).toBe(false);
			}
		});
	});

	describe('invalid queue entry handling', () => {
		it('continues processing after encountering invalid JSON in queue', async () => {
			server.use(createPhotoDnaMatchHandler({isMatch: false}));
			await harness.kvProvider.rpush(QUEUE_KEY, 'invalid-json-{{{');

			const validEntry = createQueueEntry({requestId: 'valid-request'});
			await harness.kvProvider.rpush(QUEUE_KEY, JSON.stringify(validEntry));

			await expect(csamScanConsumer({}, mockHelpers)).resolves.not.toThrow();

			expect(publishSpy).toHaveBeenCalledTimes(1);
			expect(publishSpy).toHaveBeenCalledWith('csam:result:valid-request', expect.any(String));
		});
	});
});
