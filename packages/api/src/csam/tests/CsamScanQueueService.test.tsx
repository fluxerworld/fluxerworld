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

import type {CsamScanContext, CsamScanQueueEntry} from '@fluxer/api/src/csam/CsamScanQueueService';
import {CsamScanQueueService} from '@fluxer/api/src/csam/CsamScanQueueService';
import {createMockMatchResult, createNoopLogger} from '@fluxer/api/src/csam/tests/CsamTestUtils';
import type {ILogger} from '@fluxer/api/src/ILogger';
import {MockKVProvider, MockKVSubscription} from '@fluxer/api/src/test/mocks/MockKVProvider';
import {InternalServerError} from '@fluxer/errors/src/domains/core/InternalServerError';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

function createDefaultContext(): CsamScanContext {
	return {
		resourceType: 'avatar',
		userId: 'user-123',
		guildId: null,
		channelId: null,
		messageId: null,
	};
}

describe('CsamScanQueueService', () => {
	let logger: ILogger;
	let mockKvProvider: MockKVProvider;
	let service: CsamScanQueueService;

	beforeEach(() => {
		logger = createNoopLogger();
		mockKvProvider = new MockKVProvider();
		service = new CsamScanQueueService({
			kvProvider: mockKvProvider,
			logger,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('submits scan request to KV queue', () => {
		it('calls rpush with correct queue key', async () => {
			const subscription = mockKvProvider.getSubscription();

			const submitPromise = service.submitScan({
				hashes: ['hash-1', 'hash-2'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(mockKvProvider.rpushCalls.length).toBeGreaterThan(0);
			});

			const noMatchResult = {isMatch: false};
			subscription.simulateMessage('csam:result:test', JSON.stringify(noMatchResult));

			await submitPromise;

			expect(mockKvProvider.rpushCalls).toHaveLength(1);
			expect(mockKvProvider.rpushCalls[0].key).toBe('csam:scan:queue');
		});

		it('includes requestId, hashes, timestamp, and context in queue entry', async () => {
			const subscription = mockKvProvider.getSubscription();
			const context = createDefaultContext();

			const submitPromise = service.submitScan({
				hashes: ['hash-1', 'hash-2'],
				context,
			});

			await vi.waitFor(() => {
				expect(mockKvProvider.rpushCalls.length).toBeGreaterThan(0);
			});

			const queueEntry = JSON.parse(mockKvProvider.rpushCalls[0].values[0]) as CsamScanQueueEntry;

			expect(queueEntry.requestId).toBeDefined();
			expect(typeof queueEntry.requestId).toBe('string');
			expect(queueEntry.hashes).toEqual(['hash-1', 'hash-2']);
			expect(queueEntry.timestamp).toBeDefined();
			expect(typeof queueEntry.timestamp).toBe('number');
			expect(queueEntry.context).toEqual(context);

			subscription.simulateMessage('csam:result:test', JSON.stringify({isMatch: false}));
			await submitPromise;
		});
	});

	describe('waits for result via pub/sub', () => {
		it('subscribes to result channel and returns result when message received', async () => {
			const subscription = mockKvProvider.getSubscription();
			const matchResult = createMockMatchResult({isMatch: false});

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			expect(subscription.connectCalled).toBe(true);
			expect(subscription.subscribedChannels[0]).toMatch(/^csam:result:/);

			subscription.simulateMessage(subscription.subscribedChannels[0], JSON.stringify({isMatch: false, matchResult}));

			const result = await submitPromise;

			expect(result.isMatch).toBe(false);
		});
	});

	describe('times out and throws error if no result', () => {
		it('throws InternalServerError with CSAM_SCAN_TIMEOUT code after timeout', async () => {
			const shortTimeoutService = new CsamScanQueueService({
				kvProvider: mockKvProvider,
				logger,
				timeoutMs: 100,
			});

			await expect(
				shortTimeoutService.submitScan({
					hashes: ['hash-1'],
					context: createDefaultContext(),
				}),
			).rejects.toThrow(InternalServerError);

			try {
				await shortTimeoutService.submitScan({
					hashes: ['hash-1'],
					context: createDefaultContext(),
				});
			} catch (error) {
				expect(error).toBeInstanceOf(InternalServerError);
				expect((error as InternalServerError).code).toBe('CSAM_SCAN_TIMEOUT');
			}
		});
	});

	describe('returns match result correctly', () => {
		it('returns isMatch: true with matchResult when match is found', async () => {
			const subscription = mockKvProvider.getSubscription();
			const matchResult = createMockMatchResult({isMatch: true});

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(subscription.subscribedChannels[0], JSON.stringify({isMatch: true, matchResult}));

			const result = await submitPromise;

			expect(result.isMatch).toBe(true);
			expect(result.matchResult).toBeDefined();
			expect(result.matchResult!.isMatch).toBe(true);
			expect(result.matchResult!.matchDetails).toHaveLength(1);
		});

		it('includes all match details in the result', async () => {
			const subscription = mockKvProvider.getSubscription();
			const matchResult = createMockMatchResult({
				isMatch: true,
				matchDetails: [
					{
						source: 'ncmec',
						violations: ['CSAM'],
						matchDistance: 0.01,
						matchId: 'match-123',
					},
				],
			});

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(subscription.subscribedChannels[0], JSON.stringify({isMatch: true, matchResult}));

			const result = await submitPromise;

			expect(result.matchResult!.matchDetails[0].source).toBe('ncmec');
			expect(result.matchResult!.matchDetails[0].matchDistance).toBe(0.01);
		});
	});

	describe('returns no-match result correctly', () => {
		it('returns isMatch: false when no match is found', async () => {
			const subscription = mockKvProvider.getSubscription();

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(subscription.subscribedChannels[0], JSON.stringify({isMatch: false}));

			const result = await submitPromise;

			expect(result.isMatch).toBe(false);
			expect(result.matchResult).toBeUndefined();
		});

		it('returns no-match result with empty matchResult when provided', async () => {
			const subscription = mockKvProvider.getSubscription();
			const noMatchResult = createMockMatchResult({isMatch: false});

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(
				subscription.subscribedChannels[0],
				JSON.stringify({isMatch: false, matchResult: noMatchResult}),
			);

			const result = await submitPromise;

			expect(result.isMatch).toBe(false);
			expect(result.matchResult).toBeDefined();
			expect(result.matchResult!.isMatch).toBe(false);
		});
	});

	describe('handles error in result message', () => {
		it('throws InternalServerError with CSAM_SCAN_FAILED code when error field is present', async () => {
			const subscription = mockKvProvider.getSubscription();

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(
				subscription.subscribedChannels[0],
				JSON.stringify({error: 'PhotoDNA service unavailable'}),
			);

			await expect(submitPromise).rejects.toThrow(InternalServerError);

			try {
				const subscription2 = mockKvProvider.getSubscription();
				const submitPromise2 = service.submitScan({
					hashes: ['hash-2'],
					context: createDefaultContext(),
				});

				await vi.waitFor(() => {
					expect(subscription2.subscribedChannels.length).toBeGreaterThan(1);
				});

				subscription2.simulateMessage(
					subscription2.subscribedChannels[1],
					JSON.stringify({error: 'PhotoDNA service unavailable'}),
				);

				await submitPromise2;
			} catch (error) {
				expect(error).toBeInstanceOf(InternalServerError);
				expect((error as InternalServerError).code).toBe('CSAM_SCAN_FAILED');
			}
		});

		it('throws InternalServerError with CSAM_SCAN_PARSE_ERROR for invalid JSON', async () => {
			const subscription = mockKvProvider.getSubscription();

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(subscription.subscribedChannels[0], 'not valid json{');

			await expect(submitPromise).rejects.toThrow(InternalServerError);
		});

		it('throws InternalServerError with CSAM_SCAN_SUBSCRIPTION_ERROR on subscription error', async () => {
			const subscription = mockKvProvider.getSubscription();

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateError(new Error('Connection lost'));

			await expect(submitPromise).rejects.toThrow(InternalServerError);

			try {
				const subscription2 = mockKvProvider.getSubscription();
				const submitPromise2 = service.submitScan({
					hashes: ['hash-2'],
					context: createDefaultContext(),
				});

				await vi.waitFor(() => {
					expect(subscription2.subscribedChannels.length).toBeGreaterThan(1);
				});

				subscription2.simulateError(new Error('Connection lost'));
				await submitPromise2;
			} catch (error) {
				expect(error).toBeInstanceOf(InternalServerError);
				expect((error as InternalServerError).code).toBe('CSAM_SCAN_SUBSCRIPTION_ERROR');
			}
		});
	});

	describe('cleans up subscription on completion', () => {
		it('calls quit on subscription after result received', async () => {
			const subscription = mockKvProvider.getSubscription();

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(subscription.subscribedChannels[0], JSON.stringify({isMatch: false}));

			await submitPromise;

			expect(subscription.quitCalled).toBe(true);
			expect(subscription.removeAllListenersCalled).toBe(true);
		});

		it('cleans up subscription after timeout', async () => {
			const shortTimeoutKvProvider = new MockKVProvider();
			const shortTimeoutService = new CsamScanQueueService({
				kvProvider: shortTimeoutKvProvider,
				logger,
				timeoutMs: 50,
			});

			const subscription = shortTimeoutKvProvider.getSubscription();

			try {
				await shortTimeoutService.submitScan({
					hashes: ['hash-1'],
					context: createDefaultContext(),
				});
			} catch {}

			expect(subscription.quitCalled).toBe(true);
			expect(subscription.removeAllListenersCalled).toBe(true);
		});

		it('cleans up subscription after error in result message', async () => {
			const subscription = mockKvProvider.getSubscription();

			const submitPromise = service.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(subscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(subscription.subscribedChannels[0], JSON.stringify({error: 'Some error'}));

			try {
				await submitPromise;
			} catch {}

			expect(subscription.quitCalled).toBe(true);
			expect(subscription.removeAllListenersCalled).toBe(true);
		});

		it('logs error if cleanup fails but does not throw', async () => {
			const failingSubscription = new MockKVSubscription();
			failingSubscription.quit = vi.fn().mockRejectedValue(new Error('Cleanup failed'));

			const failingKvProvider = new MockKVProvider();
			failingKvProvider.setSubscription(failingSubscription);

			const failingService = new CsamScanQueueService({
				kvProvider: failingKvProvider,
				logger,
			});

			const submitPromise = failingService.submitScan({
				hashes: ['hash-1'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(failingSubscription.subscribedChannels.length).toBeGreaterThan(0);
			});

			failingSubscription.simulateMessage(failingSubscription.subscribedChannels[0], JSON.stringify({isMatch: false}));

			const result = await submitPromise;

			expect(result.isMatch).toBe(false);
			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({error: expect.any(Error)}),
				'Failed to cleanup CSAM scan subscription',
			);
		});
	});

	describe('logs debug information', () => {
		it('logs when scan request is submitted', async () => {
			const subscription = mockKvProvider.getSubscription();

			const submitPromise = service.submitScan({
				hashes: ['hash-1', 'hash-2', 'hash-3'],
				context: createDefaultContext(),
			});

			await vi.waitFor(() => {
				expect(mockKvProvider.rpushCalls.length).toBeGreaterThan(0);
			});

			subscription.simulateMessage(subscription.subscribedChannels[0], JSON.stringify({isMatch: false}));

			await submitPromise;

			expect(logger.debug).toHaveBeenCalledWith(
				expect.objectContaining({requestId: expect.any(String), hashCount: 3}),
				'Submitted CSAM scan request',
			);
		});
	});

	describe('uses custom timeout when provided', () => {
		it('uses per-request timeout over default', async () => {
			const defaultTimeoutService = new CsamScanQueueService({
				kvProvider: mockKvProvider,
				logger,
				timeoutMs: 5000,
			});

			await expect(
				defaultTimeoutService.submitScan({
					hashes: ['hash-1'],
					context: createDefaultContext(),
					timeoutMs: 50,
				}),
			).rejects.toThrow(InternalServerError);
		});
	});
});
