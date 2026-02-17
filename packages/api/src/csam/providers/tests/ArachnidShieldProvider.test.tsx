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
import {ArachnidShieldProvider} from '@fluxer/api/src/csam/providers/ArachnidShieldProvider';
import {createNoopLogger, TEST_FIXTURES} from '@fluxer/api/src/csam/tests/CsamTestUtils';
import type {ILogger} from '@fluxer/api/src/ILogger';
import {MockStorageService} from '@fluxer/api/src/test/mocks/MockStorageService';
import {
	type ArachnidShieldRequestCapture,
	createArachnidShieldErrorHandler,
	createArachnidShieldHandler,
	createArachnidShieldSequenceHandler,
} from '@fluxer/api/src/test/msw/handlers/ArachnidShieldHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const DEFAULT_CONFIG = {
	endpoint: 'https://shield.projectarachnid.com/v1/media',
	username: 'test-user',
	password: 'test-password',
	timeoutMs: 30000,
	maxRetries: 3,
	retryBackoffMs: 100,
};

function makeProvider(
	logger: ILogger,
	storageService = new MockStorageService({fileData: TEST_FIXTURES.PNG_1X1_TRANSPARENT}),
	config = DEFAULT_CONFIG,
): ArachnidShieldProvider {
	return new ArachnidShieldProvider({config, logger, storageService});
}

describe('ArachnidShieldProvider', () => {
	let logger: ILogger;

	beforeEach(() => {
		logger = createNoopLogger();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('providerName', () => {
		it('returns arachnid_shield as provider name', () => {
			const provider = makeProvider(logger);
			expect(provider.providerName).toBe('arachnid_shield');
		});
	});

	describe('scanMedia', () => {
		it('returns isMatch: false for null content type', async () => {
			const provider = makeProvider(logger);

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
			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'text/plain',
			});

			expect(result).toEqual({isMatch: false});
		});

		it('returns isMatch: false for audio/mp3 content type', async () => {
			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'audio/mp3',
			});

			expect(result).toEqual({isMatch: false});
		});

		it('returns isMatch: false when file not found in storage', async () => {
			const storageService = new MockStorageService({fileData: null});
			const provider = makeProvider(logger, storageService);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result).toEqual({isMatch: false});
			expect(logger.debug).toHaveBeenCalledWith({bucket: 'test-bucket', key: 'test-key'}, 'File not found in storage');
		});

		it('sends correct headers with basic auth', async () => {
			const requestCapture: {current: ArachnidShieldRequestCapture | null} = {current: null};
			server.use(createArachnidShieldHandler({}, requestCapture));

			const storageService = new MockStorageService({fileData: TEST_FIXTURES.PNG_1X1_TRANSPARENT});
			const provider = makeProvider(logger, storageService);

			await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(requestCapture.current).not.toBeNull();
			const expectedAuth = `Basic ${Buffer.from('test-user:test-password').toString('base64')}`;
			expect(requestCapture.current!.headers.get('Authorization')).toBe(expectedAuth);
			expect(requestCapture.current!.headers.get('Content-Type')).toBe('image/png');
		});

		it('sends full file data to API', async () => {
			const fileData = TEST_FIXTURES.PNG_1X1_TRANSPARENT;
			const requestCapture: {current: ArachnidShieldRequestCapture | null} = {current: null};
			server.use(createArachnidShieldHandler({}, requestCapture));

			const storageService = new MockStorageService({fileData});
			const provider = makeProvider(logger, storageService);

			await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(requestCapture.current).not.toBeNull();
			const sentData = new Uint8Array(requestCapture.current!.body);
			expect(sentData).toEqual(new Uint8Array(fileData));
		});

		it('returns isMatch: false for no-known-match classification', async () => {
			server.use(createArachnidShieldHandler({classification: 'no-known-match', sha256Hex: 'abc123def456'}));

			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result.isMatch).toBe(false);
			expect(result.hashes).toEqual(['abc123def456']);
		});

		it('returns isMatch: false for test classification', async () => {
			server.use(createArachnidShieldHandler({classification: 'test', sha256Hex: 'test-hash'}));

			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result.isMatch).toBe(false);
		});

		it('returns isMatch: true for csam classification', async () => {
			const trackingHash = `csam-match-${randomUUID()}`;
			server.use(
				createArachnidShieldHandler({
					classification: 'csam',
					sha256Hex: trackingHash,
					matchId: 'match-123',
				}),
			);

			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result.isMatch).toBe(true);
			expect(result.matchResult).toBeDefined();
			expect(result.matchResult!.isMatch).toBe(true);
			expect(result.matchResult!.trackingId).toBe(trackingHash);
			expect(result.matchResult!.provider).toBe('arachnid_shield');
			expect(result.hashes).toEqual([trackingHash]);
		});

		it('returns isMatch: true for harmful-abusive-material classification', async () => {
			server.use(createArachnidShieldHandler({classification: 'harmful-abusive-material', sha256Hex: 'ham-hash'}));

			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result.isMatch).toBe(true);
			expect(result.matchResult!.matchDetails[0].violations).toContain('harmful-abusive-material');
		});

		it('logs warning when CSAM match is detected', async () => {
			server.use(createArachnidShieldHandler({classification: 'csam', sha256Hex: 'warning-hash'}));

			const provider = makeProvider(logger);

			await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(logger.warn).toHaveBeenCalledWith(
				expect.objectContaining({trackingId: 'warning-hash'}),
				'CSAM match detected',
			);
		});

		it('includes match details from API response', async () => {
			server.use(
				createArachnidShieldHandler({
					classification: 'csam',
					matchType: 'near',
					sha1Base32: 'abc123base32',
					sha256Hex: 'detail-hash',
					sizeBytes: 1024,
					nearMatchDetails: [
						{
							classification: 'csam',
							sha1_base32: 'match-sha1',
							sha256_hex: 'match-sha256',
							timestamp: 1609459200,
						},
					],
				}),
			);

			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result.matchResult!.matchDetails).toHaveLength(1);
			expect(result.matchResult!.matchDetails[0]).toEqual({
				source: 'arachnid',
				violations: ['csam'],
				matchDistance: 1,
				matchId: 'match-sha256',
			});
		});

		it('does not return frames field for images', async () => {
			server.use(createArachnidShieldHandler({classification: 'no-known-match', sha256Hex: 'no-frames-hash'}));

			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result.frames).toBeUndefined();
		});

		it('does not return frames field for videos', async () => {
			server.use(createArachnidShieldHandler({classification: 'no-known-match', sha256Hex: 'video-hash'}));

			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'video-key',
				contentType: 'video/mp4',
			});

			expect(result.frames).toBeUndefined();
		});

		it('retries on 429 status', async () => {
			server.use(
				createArachnidShieldSequenceHandler([
					{status: 429, headers: {ratelimit: '"burst";r=0;t=1'}},
					{
						status: 200,
						body: {
							classification: 'no-known-match',
							sha256_hex: 'retry-hash',
							sha1_base32: 'test-sha1',
							match_type: null,
							size_bytes: 1024,
						},
					},
				]),
			);

			const storageService = new MockStorageService({fileData: TEST_FIXTURES.PNG_1X1_TRANSPARENT});
			const provider = makeProvider(logger, storageService, {...DEFAULT_CONFIG, retryBackoffMs: 10});

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result.isMatch).toBe(false);
		});

		it('retries on 503 status', async () => {
			server.use(
				createArachnidShieldSequenceHandler([
					{status: 503},
					{
						status: 200,
						body: {
							classification: 'no-known-match',
							sha256_hex: 'retry-503-hash',
							sha1_base32: 'test-sha1',
							match_type: null,
							size_bytes: 1024,
						},
					},
				]),
			);

			const storageService = new MockStorageService({fileData: TEST_FIXTURES.PNG_1X1_TRANSPARENT});
			const provider = makeProvider(logger, storageService, {...DEFAULT_CONFIG, retryBackoffMs: 10});

			const result = await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(result.isMatch).toBe(false);
		});

		it('does not retry on 400 status', async () => {
			server.use(createArachnidShieldErrorHandler(400, 'Bad Request'));

			const storageService = new MockStorageService({fileData: TEST_FIXTURES.PNG_1X1_TRANSPARENT});
			const provider = makeProvider(logger, storageService, {...DEFAULT_CONFIG, retryBackoffMs: 10});

			await expect(
				provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
				}),
			).rejects.toThrow('Arachnid Shield API returned 400');
		});

		it('respects maxRetries limit', async () => {
			server.use(createArachnidShieldErrorHandler(500));

			const storageService = new MockStorageService({fileData: TEST_FIXTURES.PNG_1X1_TRANSPARENT});
			const provider = makeProvider(logger, storageService, {...DEFAULT_CONFIG, maxRetries: 2, retryBackoffMs: 10});

			await expect(
				provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
				}),
			).rejects.toThrow('Arachnid Shield API returned 500 after 3 attempts');
		});

		it('logs retry attempts', async () => {
			server.use(
				createArachnidShieldSequenceHandler([
					{status: 503},
					{
						status: 200,
						body: {
							classification: 'no-known-match',
							sha256_hex: 'log-retry-hash',
							sha1_base32: 'test-sha1',
							match_type: null,
							size_bytes: 1024,
						},
					},
				]),
			);

			const storageService = new MockStorageService({fileData: TEST_FIXTURES.PNG_1X1_TRANSPARENT});
			const provider = makeProvider(logger, storageService, {...DEFAULT_CONFIG, retryBackoffMs: 10});

			await provider.scanMedia({
				bucket: 'test-bucket',
				key: 'test-key',
				contentType: 'image/png',
			});

			expect(logger.warn).toHaveBeenCalledWith(
				expect.objectContaining({attempt: 0, status: 503}),
				'Arachnid Shield API request failed, retrying',
			);
		});

		it('throws error when storage read fails', async () => {
			const storageService = new MockStorageService({shouldFail: true});
			const provider = makeProvider(logger, storageService);

			await expect(
				provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
				}),
			).rejects.toThrow('Mock storage read failure');
		});

		it('logs error when scan fails', async () => {
			const storageService = new MockStorageService({shouldFail: true});
			const provider = makeProvider(logger, storageService);

			await expect(
				provider.scanMedia({
					bucket: 'test-bucket',
					key: 'test-key',
					contentType: 'image/png',
				}),
			).rejects.toThrow();

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({bucket: 'test-bucket', key: 'test-key'}),
				'Failed to scan media',
			);
		});
	});

	describe('scanBase64', () => {
		it('returns isMatch: false for unscannable media type', async () => {
			const provider = makeProvider(logger);

			const result = await provider.scanBase64({base64: 'dGVzdA==', mimeType: 'text/plain'});

			expect(result).toEqual({isMatch: false});
		});

		it('decodes base64 and sends to API', async () => {
			const base64Data = TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64');
			const requestCapture: {current: ArachnidShieldRequestCapture | null} = {current: null};
			server.use(createArachnidShieldHandler({sha256Hex: 'base64-hash'}, requestCapture));

			const storageService = new MockStorageService({fileData: TEST_FIXTURES.PNG_1X1_TRANSPARENT});
			const provider = makeProvider(logger, storageService);

			await provider.scanBase64({base64: base64Data, mimeType: 'image/png'});

			expect(requestCapture.current).not.toBeNull();
			const sentData = Buffer.from(requestCapture.current!.body);
			expect(sentData.toString('base64')).toBe(base64Data);
		});

		it('returns match result with provider field when match found', async () => {
			server.use(createArachnidShieldHandler({classification: 'csam', sha256Hex: 'base64-match-hash'}));

			const provider = makeProvider(logger);

			const result = await provider.scanBase64({
				base64: TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64'),
				mimeType: 'image/png',
			});

			expect(result.isMatch).toBe(true);
			expect(result.matchResult!.provider).toBe('arachnid_shield');
		});

		it('does not return frames field', async () => {
			server.use(createArachnidShieldHandler({classification: 'no-known-match', sha256Hex: 'no-frames-base64'}));

			const provider = makeProvider(logger);

			const result = await provider.scanBase64({
				base64: TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64'),
				mimeType: 'image/png',
			});

			expect(result.frames).toBeUndefined();
		});
	});

	describe('context handling', () => {
		it('uses context for telemetry', async () => {
			server.use(createArachnidShieldHandler({classification: 'no-known-match', sha256Hex: 'context-hash'}));

			const provider = makeProvider(logger);

			const result = await provider.scanMedia({
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

			expect(result.isMatch).toBe(false);
		});
	});
});
