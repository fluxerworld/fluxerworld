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

import {SynchronousCsamScanner} from '@fluxer/api/src/csam/SynchronousCsamScanner';
import {
	createMockFrameSamples,
	createMockMatchResult,
	createNoopLogger,
} from '@fluxer/api/src/csam/tests/CsamTestUtils';
import type {ILogger} from '@fluxer/api/src/ILogger';
import type {MediaProxyMetadataResponse} from '@fluxer/api/src/infrastructure/IMediaService';
import {MockCsamScanQueueService} from '@fluxer/api/src/test/mocks/MockCsamScanQueueService';
import {MockMediaService} from '@fluxer/api/src/test/mocks/MockMediaService';
import {MockPhotoDnaHashClient} from '@fluxer/api/src/test/mocks/MockPhotoDnaHashClient';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('SynchronousCsamScanner', () => {
	let logger: ILogger;

	beforeEach(() => {
		logger = createNoopLogger();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('disabled scanner', () => {
		it('returns isMatch: false immediately when disabled', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: false,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'});

			expect(result).toEqual({isMatch: false});
			expect(hashClient.hashFramesSpy).not.toHaveBeenCalled();
			expect(queueService.submitScanSpy).not.toHaveBeenCalled();
			expect(mediaService.getMetadataSpy).not.toHaveBeenCalled();
		});

		it('returns isMatch: false for scanBase64 when disabled', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: false,
				logger,
			});

			const result = await scanner.scanBase64({base64: 'dGVzdA==', mimeType: 'image/png'});

			expect(result).toEqual({isMatch: false});
			expect(hashClient.hashFramesSpy).not.toHaveBeenCalled();
			expect(queueService.submitScanSpy).not.toHaveBeenCalled();
		});
	});

	describe('unscannable media types', () => {
		it('returns isMatch: false for null content type', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: null});

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

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'text/plain'});

			expect(result).toEqual({isMatch: false});
			expect(mediaService.getMetadataSpy).not.toHaveBeenCalled();
		});

		it('returns isMatch: false for application/json content type', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'application/json'});

			expect(result).toEqual({isMatch: false});
		});

		it('returns isMatch: false for audio/mp3 content type', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'audio/mp3'});

			expect(result).toEqual({isMatch: false});
		});

		it('skips scanning for unscannable media type in scanBase64', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanBase64({base64: 'dGVzdA==', mimeType: 'text/plain'});

			expect(result).toEqual({isMatch: false});
			expect(logger.debug).toHaveBeenCalledWith({mimeType: 'text/plain'}, 'Skipping non-scannable media type');
		});
	});

	describe('scannable media types', () => {
		it.each([
			['image/jpeg'],
			['image/png'],
			['image/gif'],
			['image/webp'],
			['image/bmp'],
			['image/tiff'],
			['image/avif'],
			['image/apng'],
			['video/mp4'],
			['video/webm'],
			['video/quicktime'],
			['video/x-msvideo'],
			['video/x-matroska'],
		])('scans %s content type', async (contentType) => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType});

			if (contentType.startsWith('video/')) {
				expect(mediaService.extractFramesSpy).toHaveBeenCalled();
			} else {
				expect(mediaService.getMetadataSpy).toHaveBeenCalled();
			}
		});

		it('handles content type with charset parameter', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/jpeg; charset=utf-8'});

			expect(mediaService.getMetadataSpy).toHaveBeenCalled();
		});
	});

	describe('no match scenario', () => {
		it('returns isMatch: false when PhotoDNA finds no match', async () => {
			const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1', 'hash-2']});
			const queueService = new MockCsamScanQueueService({
				matchResult: createMockMatchResult({isMatch: false}),
			});
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'});

			expect(result.isMatch).toBe(false);
			expect(result.matchResult).toBeDefined();
			expect(result.matchResult!.isMatch).toBe(false);
			expect(result.frames).toBeDefined();
			expect(result.hashes).toEqual(['hash-1', 'hash-2']);
		});

		it('returns isMatch: false when no frames are extracted from video', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService({returnEmptyFrames: true});

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'video/mp4'});

			expect(result).toEqual({isMatch: false});
			expect(logger.debug).toHaveBeenCalledWith(
				{bucket: 'test-bucket', key: 'test-key'},
				'No frames extracted from media',
			);
		});

		it('returns isMatch: false when no hashes are generated', async () => {
			const hashClient = new MockPhotoDnaHashClient({returnEmpty: true});
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'});

			expect(result.isMatch).toBe(false);
			expect(result.frames).toBeDefined();
			expect(result.hashes).toEqual([]);
			expect(logger.debug).toHaveBeenCalledWith('No hashes generated from frames');
			expect(queueService.submitScanSpy).not.toHaveBeenCalled();
		});
	});

	describe('match detected scenario', () => {
		it('returns isMatch: true with matchResult, frames, and hashes when match found', async () => {
			const hashes = ['hash-1', 'hash-2'];
			const matchResult = createMockMatchResult({isMatch: true});
			const hashClient = new MockPhotoDnaHashClient({hashes});
			const queueService = new MockCsamScanQueueService({matchResult});
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'});

			expect(result.isMatch).toBe(true);
			expect(result.matchResult).toBeDefined();
			expect(result.matchResult!.isMatch).toBe(true);
			expect(result.matchResult!.matchDetails).toHaveLength(1);
			expect(result.frames).toBeDefined();
			expect(result.frames!.length).toBeGreaterThan(0);
			expect(result.hashes).toEqual(hashes);
		});

		it('logs warning when CSAM match is detected', async () => {
			const matchResult = createMockMatchResult({isMatch: true, trackingId: 'test-tracking-id'});
			const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1']});
			const queueService = new MockCsamScanQueueService({matchResult});
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'});

			expect(logger.warn).toHaveBeenCalledWith({trackingId: 'test-tracking-id', matchCount: 1}, 'CSAM match detected');
		});
	});

	describe('frame extraction from S3', () => {
		it('extracts frames from video using extractFrames', async () => {
			const frames = [
				{timestamp: 0, mime_type: 'image/jpeg', base64: 'frame0'},
				{timestamp: 500, mime_type: 'image/jpeg', base64: 'frame1'},
				{timestamp: 1000, mime_type: 'image/jpeg', base64: 'frame2'},
			];
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService({frames});

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'video-key', contentType: 'video/mp4'});

			expect(mediaService.extractFramesSpy).toHaveBeenCalledWith({
				type: 's3',
				bucket: 'test-bucket',
				key: 'video-key',
			});
			expect(result.frames).toHaveLength(3);
			expect(result.frames![0]).toEqual({timestamp: 0, mimeType: 'image/jpeg', base64: 'frame0'});
		});

		it('extracts single frame from image using getMetadata', async () => {
			const metadata: MediaProxyMetadataResponse = {
				format: 'png',
				content_type: 'image/png',
				content_hash: 'hash123',
				size: 2048,
				nsfw: false,
				base64: 'imagebase64data',
			};
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService({metadata});

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'image-key', contentType: 'image/png'});

			expect(mediaService.getMetadataSpy).toHaveBeenCalledWith({
				type: 's3',
				bucket: 'test-bucket',
				key: 'image-key',
				with_base64: true,
				isNSFWAllowed: true,
			});
			expect(result.frames).toHaveLength(1);
			expect(result.frames![0]).toEqual({
				timestamp: 0,
				mimeType: 'image/png',
				base64: 'imagebase64data',
			});
		});

		it('throws error when metadata has no base64', async () => {
			const metadata: MediaProxyMetadataResponse = {
				format: 'png',
				content_type: 'image/png',
				content_hash: 'hash123',
				size: 2048,
				nsfw: false,
			};
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService({metadata});

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await expect(
				scanner.scanMedia({bucket: 'test-bucket', key: 'image-key', contentType: 'image/png'}),
			).rejects.toThrow('Media proxy returned metadata without base64 for image scan');
		});
	});

	describe('frame extraction failure', () => {
		it('throws error when metadata returns null for image', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService({returnNullMetadata: true});

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await expect(
				scanner.scanMedia({bucket: 'test-bucket', key: 'image-key', contentType: 'image/png'}),
			).rejects.toThrow('Media proxy returned no metadata for image scan');
			expect(logger.error).toHaveBeenCalledWith(
				{error: expect.any(Error), bucket: 'test-bucket', key: 'image-key'},
				'Failed to scan media',
			);
		});
		it('throws error when frame extraction fails for video', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService({shouldFailFrameExtraction: true});

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await expect(
				scanner.scanMedia({bucket: 'test-bucket', key: 'video-key', contentType: 'video/mp4'}),
			).rejects.toThrow('Mock frame extraction failure');
			expect(logger.error).toHaveBeenCalledWith(
				{error: expect.any(Error), bucket: 'test-bucket', key: 'video-key'},
				'Failed to scan media',
			);
		});

		it('throws error when metadata fetch fails for image', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService({shouldFailMetadata: true});

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await expect(
				scanner.scanMedia({bucket: 'test-bucket', key: 'image-key', contentType: 'image/png'}),
			).rejects.toThrow('Mock metadata fetch failure');
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('hash generation failure', () => {
		it('throws error when hash client fails', async () => {
			const hashClient = new MockPhotoDnaHashClient({shouldFail: true});
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await expect(
				scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'}),
			).rejects.toThrow('Mock hash client failure');
			expect(hashClient.hashFramesSpy).toHaveBeenCalled();
			expect(queueService.submitScanSpy).not.toHaveBeenCalled();
		});
	});

	describe('queue service failure', () => {
		it('throws error when queue service fails', async () => {
			const hashClient = new MockPhotoDnaHashClient({hashes: ['hash-1']});
			const queueService = new MockCsamScanQueueService({shouldFail: true});
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await expect(
				scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'}),
			).rejects.toThrow('Mock queue service failure');
			expect(hashClient.hashFramesSpy).toHaveBeenCalled();
			expect(queueService.submitScanSpy).toHaveBeenCalled();
		});
	});

	describe('scanBase64 method', () => {
		it('scans base64 image data successfully', async () => {
			const base64Data = Buffer.from('test-image-data').toString('base64');
			const hashes = ['base64-hash-1'];
			const matchResult = createMockMatchResult({isMatch: false});
			const hashClient = new MockPhotoDnaHashClient({hashes});
			const queueService = new MockCsamScanQueueService({matchResult});
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanBase64({base64: base64Data, mimeType: 'image/png'});

			expect(result.isMatch).toBe(false);
			expect(result.frames).toHaveLength(1);
			expect(result.frames![0]).toEqual({
				timestamp: 0,
				mimeType: 'image/png',
				base64: base64Data,
			});
			expect(result.hashes).toEqual(hashes);
		});

		it('returns match result when base64 content matches', async () => {
			const base64Data = Buffer.from('suspicious-image').toString('base64');
			const matchResult = createMockMatchResult({isMatch: true});
			const hashClient = new MockPhotoDnaHashClient({hashes: ['match-hash']});
			const queueService = new MockCsamScanQueueService({matchResult});
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanBase64({base64: base64Data, mimeType: 'image/jpeg'});

			expect(result.isMatch).toBe(true);
			expect(result.matchResult!.isMatch).toBe(true);
			expect(logger.warn).toHaveBeenCalled();
		});

		it('throws error when hash generation fails for base64', async () => {
			const hashClient = new MockPhotoDnaHashClient({shouldFail: true});
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await expect(scanner.scanBase64({base64: 'dGVzdA==', mimeType: 'image/png'})).rejects.toThrow(
				'Mock hash client failure',
			);
			expect(hashClient.hashFramesSpy).toHaveBeenCalled();
			expect(queueService.submitScanSpy).not.toHaveBeenCalled();
		});

		it('does not call media service for base64 scanning', async () => {
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService();
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			await scanner.scanBase64({base64: 'dGVzdA==', mimeType: 'image/png'});

			expect(mediaService.getMetadataSpy).not.toHaveBeenCalled();
			expect(mediaService.extractFramesSpy).not.toHaveBeenCalled();
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

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'video-key', contentType: 'video/mp4'});

			expect(result.frames).toHaveLength(3);
			expect(hashClient.hashFramesSpy).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({timestamp: 0}),
					expect.objectContaining({timestamp: 100}),
					expect.objectContaining({timestamp: 200}),
				]),
			);
		});

		it('works with createMockMatchResult utility for match', async () => {
			const matchResult = createMockMatchResult({
				isMatch: true,
				matchDetails: [
					{
						source: 'ncmec',
						violations: ['CSAM', 'CGI'],
						matchDistance: 0.005,
						matchId: 'detail-123',
					},
				],
			});
			const hashClient = new MockPhotoDnaHashClient();
			const queueService = new MockCsamScanQueueService({matchResult});
			const mediaService = new MockMediaService();

			const scanner = new SynchronousCsamScanner(hashClient, mediaService, queueService, {
				enabled: true,
				logger,
			});

			const result = await scanner.scanMedia({bucket: 'test-bucket', key: 'test-key', contentType: 'image/png'});

			expect(result.isMatch).toBe(true);
			expect(result.matchResult!.matchDetails[0]!.source).toBe('ncmec');
			expect(result.matchResult!.matchDetails[0]!.violations).toContain('CSAM');
		});
	});
});
