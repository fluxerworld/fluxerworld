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

import {PhotoDnaProvider} from '@fluxer/api/src/csam/providers/PhotoDnaProvider';
import {
	createMockFrameSamples,
	createMockMatchResult,
	createNoopLogger,
} from '@fluxer/api/src/csam/tests/CsamTestUtils';
import type {ILogger} from '@fluxer/api/src/ILogger';
import * as CsamTelemetry from '@fluxer/api/src/telemetry/CsamTelemetry';
import {MockCsamScanQueueService} from '@fluxer/api/src/test/mocks/MockCsamScanQueueService';
import {MockMediaService} from '@fluxer/api/src/test/mocks/MockMediaService';
import {MockPhotoDnaHashClient} from '@fluxer/api/src/test/mocks/MockPhotoDnaHashClient';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('PhotoDnaProvider', () => {
	let logger: ILogger;

	beforeEach(() => {
		logger = createNoopLogger();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	describe('providerName', () => {
		it('returns photo_dna as provider name', () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

			expect(provider.providerName).toBe('photo_dna');
		});
	});

	describe('scanMedia', () => {
		describe('unscannable media types', () => {
			it('returns isMatch: false for null content type', async () => {
				const hashClient = new MockPhotoDnaHashClient();
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				const result = await provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: null,
				});

				expect(result).toEqual({isMatch: false});
				expect(logger.debug).toHaveBeenCalledWith(
					{bucket: 'test-bucket', key: 'test-key', contentType: null},
					'Skipping non-scannable media type',
				);
			});

			it('returns isMatch: false for text/plain content type', async () => {
				const hashClient = new MockPhotoDnaHashClient();
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				const result = await provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'text/plain',
				});

				expect(result).toEqual({isMatch: false});
			});

			it('returns isMatch: false for audio/mp3 content type', async () => {
				const hashClient = new MockPhotoDnaHashClient();
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				const result = await provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'audio/mp3',
				});

				expect(result).toEqual({isMatch: false});
			});
		});

		describe('scannable media types', () => {
			it.each([
				['image/jpeg'],
				['image/png'],
				['image/gif'],
				['image/webp'],
				['video/mp4'],
				['video/webm'],
			])('scans %s content type', async (contentType) => {
				const hashClient = new MockPhotoDnaHashClient();
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				await provider.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType});

				if (contentType.startsWith('video/')) {
					expect(mediaService.extractFramesSpy).toHaveBeenCalled();
				} else {
					expect(mediaService.getMetadataSpy).toHaveBeenCalled();
				}
			});
		});

		describe('no match scenario', () => {
			it('returns isMatch: false when PhotoDNA finds no match', async () => {
				const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1', 'hash-2']});
				const queueService = new MockCsamScanQueueService({
					matchResult: createMockMatchResult({isMatch: false}),
				});
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				const result = await provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
				});

				expect(result.isMatch).toBe(false);
				expect(result.matchResult).toBeDefined();
				expect(result.matchResult!.isMatch).toBe(false);
				expect(result.frames).toBeDefined();
				expect(result.hashes).toEqual(['hash-1', 'hash-2']);
			});

			it('returns isMatch: false when no frames are extracted', async () => {
				const hashClient = new MockPhotoDnaHashClient();
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService({returnNullMetadata: true});

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				const result = await provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
				});

				expect(result).toEqual({isMatch: false});
			});

			it('returns isMatch: false when no hashes are generated', async () => {
				const hashClient = new MockPhotoDnaHashClient({returnEmpty: true});
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				const result = await provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
				});

				expect(result.isMatch).toBe(false);
				expect(result.hashes).toEqual([]);
				expect(queueService.submitScanSpy).not.toHaveBeenCalled();
			});
		});

		describe('match detected scenario', () => {
			it('returns isMatch: true with matchResult when match found', async () => {
				const hashes = ['hash-1', 'hash-2'];
				const matchResult = createMockMatchResult({isMatch: true});
				const hashClient = new MockPhotoDnaHashClient({hashes});
				const queueService = new MockCsamScanQueueService({matchResult});
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				const result = await provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
				});

				expect(result.isMatch).toBe(true);
				expect(result.matchResult).toBeDefined();
				expect(result.matchResult!.isMatch).toBe(true);
				expect(result.matchResult!.provider).toBe('photo_dna');
				expect(result.hashes).toEqual(hashes);
			});

			it('logs warning when CSAM match is detected', async () => {
				const matchResult = createMockMatchResult({isMatch: true, trackingId: 'test-tracking-id'});
				const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1']});
				const queueService = new MockCsamScanQueueService({matchResult});
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				await provider.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'});

				expect(logger.warn).toHaveBeenCalledWith(
					{trackingId: 'test-tracking-id', matchCount: 1},
					'CSAM match detected',
				);
			});

			it('records telemetry when match details are missing', async () => {
				const recordCsamMatchSpy = vi.spyOn(CsamTelemetry, 'recordCsamMatch');
				const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1']});
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService();
				vi.spyOn(queueService, 'submitScan').mockResolvedValue({isMatch: true});

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				const result = await provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
					context: {
						resourceType: 'attachment',
						userId: null,
						guildId: null,
						channelId: null,
						messageId: null,
					},
				});

				expect(result.isMatch).toBe(true);
				expect(result.matchResult).toBeUndefined();
				expect(recordCsamMatchSpy).toHaveBeenCalledWith({
					resourceType: 'attachment',
					source: 'synchronous',
					matchCount: 0,
				});
				recordCsamMatchSpy.mockRestore();
				expect(logger.warn).toHaveBeenCalledWith({trackingId: undefined, matchCount: 0}, 'CSAM match detected');
			});
		});

		describe('error handling', () => {
			it('throws error when frame extraction fails', async () => {
				const hashClient = new MockPhotoDnaHashClient();
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService({shouldFailFrameExtraction: true});

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				await expect(
					provider.scanMedia({bucket: 'test-bucket', key: 'video-key', contentType: 'video/mp4'}),
				).rejects.toThrow('Mock frame extraction failure');
			});

			it('throws error when hash client fails', async () => {
				const hashClient = new MockPhotoDnaHashClient({shouldFail: true});
				const queueService = new MockCsamScanQueueService();
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				await expect(
					provider.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'}),
				).rejects.toThrow('Mock hash client failure');
			});

			it('throws error when queue service fails', async () => {
				const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1']});
				const queueService = new MockCsamScanQueueService({shouldFail: true});
				const mediaService = new MockMediaService();

				const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

				await expect(
					provider.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'}),
				).rejects.toThrow('Mock queue service failure');
			});
		});
	});

	describe('scanBase64', () => {
		it('returns isMatch: false for unscannable media type', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

			const result = await provider.scanBase64({base64: 'dGVzdA==', mimeType: 'text/plain'});

			expect(result).toEqual({isMatch: false});
		});

		it('scans base64 image data successfully', async () => {
			const base64Data = Buffer.from('test-image-data').toString('base64');
			const hashes = ['base64-hash-1'];
			const matchResult = createMockMatchResult({isMatch: false});
			const hashClient = new MockPhotoDnaHashClient({hashes});
			const queueService = new MockCsamScanQueueService({matchResult});
			const mediaService = new MockMediaService();

			const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

			const result = await provider.scanBase64({base64: base64Data, mimeType: 'image/png'});

			expect(result.isMatch).toBe(false);
			expect(result.frames).toHaveLength(1);
			expect(result.frames![0]).toEqual({
				timestamp: 0,
				mimeType: 'image/png',
				base64: base64Data,
			});
			expect(result.hashes).toEqual(hashes);
		});

		it('returns match result with provider field when match found', async () => {
			const matchResult = createMockMatchResult({isMatch: true});
			const hashClient = new MockPhotoDnaHashClient({hashes: ['match-hash']});
			const queueService = new MockCsamScanQueueService({matchResult});
			const mediaService = new MockMediaService();

			const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

			const result = await provider.scanBase64({
				base64: Buffer.from('suspicious-image').toString('base64'),
				mimeType: 'image/jpeg',
			});

			expect(result.isMatch).toBe(true);
			expect(result.matchResult!.provider).toBe('photo_dna');
		});

		it('does not call media service for base64 scanning', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

			await provider.scanBase64({base64: 'dGVzdA==', mimeType: 'image/png'});

			expect(mediaService.getMetadataSpy).not.toHaveBeenCalled();
			expect(mediaService.extractFramesSpy).not.toHaveBeenCalled();
		});
	});

	describe('context handling', () => {
		it('passes context to queue service', async () => {
			const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1']});
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

			await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
				context: {
					resourceType: 'attachment',
					userId: '123',
					guildId: '456',
					channelId: '789',
					messageId: '012',
				},
			});

			expect(queueService.submitScanSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					context: {
						resourceType: 'attachment',
						userId: '123',
						guildId: '456',
						channelId: '789',
						messageId: '012',
					},
				}),
			);
		});

		it('uses default context when not provided', async () => {
			const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1']});
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

			await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(queueService.submitScanSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					context: {
						resourceType: 'other',
						userId: null,
						guildId: null,
						channelId: null,
						messageId: null,
					},
				}),
			);
		});
	});

	describe('integration with test utilities', () => {
		it('works with createMockFrameSamples utility', async () => {
			const mockFrames = createMockFrameSamples(3);
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService({
				frames: mockFrames.map((f) => ({
					timestamp: f.timestamp,
					mime_type: f.mimeType,
					base64: f.base64,
				})),
			});

			const provider = new PhotoDnaProvider(hashClient, mediaService, queueService, {logger});

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'video-key',
				contentType: 'video/mp4',
			});

			expect(result.frames).toHaveLength(3);
		});
	});
});
