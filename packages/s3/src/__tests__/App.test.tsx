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

import * as fs from 'node:fs/promises';
import {createMockLogger} from '@fluxer/logger/src/mock';
import {createS3App} from '@fluxer/s3/src/App';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const testRoot = `/tmp/fluxer-s3-test-app-${Date.now()}`;

const mockLogger = createMockLogger();

const authConfig = {
	accessKey: 'test-access-key',
	secretKey: 'test-secret-key',
};

beforeEach(async () => {
	vi.clearAllMocks();
	await fs.rm(testRoot, {recursive: true, force: true});
});

describe('createS3App', () => {
	describe('health endpoint', () => {
		it('should respond to /_health and apply response headers', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const res = await app.request('http://localhost/_health', {
				headers: {
					origin: 'http://example.com',
					'x-amz-request-id': 'test-id',
				},
			});

			expect(res.status).toBe(200);
			expect(res.headers.get('x-amz-request-id')).toBe('test-id');
			expect(res.headers.get('x-amz-id-2')).toBe('test-id');
			expect(res.headers.get('Server')).toBe('FluxerS3');
			expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com');
		});

		it('should generate a request id when missing and omit CORS headers when no origin', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const res = await app.request('http://localhost/_health');
			expect(res.status).toBe(200);
			expect(res.headers.get('x-amz-request-id')).toMatch(/^[0-9a-f-]{16,}$/i);
			expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
		});
	});

	describe('authentication required', () => {
		it('should reject unauthenticated requests to non-health endpoints', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const res = await app.request('http://localhost/test-bucket/test-key');
			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).toContain('<Code>AccessDenied</Code>');
		});

		it('should return S3-style error for unknown routes without auth', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const res = await app.request('http://localhost/somewhere', {method: 'PATCH'});
			expect(res.status).toBe(403);
			const xml = await res.text();
			expect(xml).toContain('<Code>AccessDenied</Code>');
		});

		it('should reject unauthenticated OPTIONS requests', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const res = await app.request('http://localhost/anything', {method: 'OPTIONS'});
			expect(res.status).toBe(403);
		});
	});

	describe('no credentials configured', () => {
		it('should reject all requests when credentials are not configured', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig: {},
			});
			const errorSpy = vi.spyOn(mockLogger, 'error');
			await initialize();

			const res = await app.request('http://localhost/test-bucket/test-key');
			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).toContain('<Code>AccessDenied</Code>');
			expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('S3 credentials not configured'));
		});
	});
});
