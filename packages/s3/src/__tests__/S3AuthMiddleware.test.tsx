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

import {createMockLogger} from '@fluxer/logger/src/mock';
import type {S3AuthConfig} from '@fluxer/s3/src/middleware/S3AuthMiddleware';
import {createS3AuthMiddleware} from '@fluxer/s3/src/middleware/S3AuthMiddleware';
import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import {Hono} from 'hono';
import {describe, expect, it, vi} from 'vitest';

describe('S3AuthMiddleware', () => {
	describe('missing credentials', () => {
		it('should reject requests when no credentials are configured', async () => {
			const mockLogger = createMockLogger();
			const errorSpy = vi.spyOn(mockLogger, 'error');
			const middleware = createS3AuthMiddleware({}, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const res = await app.request('http://localhost/');

			expect(res.status).toBe(403);
			expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('S3 credentials not configured'));
			const body = await res.text();
			expect(body).toContain('<Code>AccessDenied</Code>');
		});

		it('should reject requests when only access key is configured', async () => {
			const mockLogger = createMockLogger();
			const errorSpy = vi.spyOn(mockLogger, 'error');
			const config: S3AuthConfig = {
				accessKey: 'test-key',
				secretKey: undefined,
			};
			const middleware = createS3AuthMiddleware(config, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const res = await app.request('http://localhost/');

			expect(res.status).toBe(403);
			expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('S3 credentials not configured'));
		});

		it('should reject requests when only secret key is configured', async () => {
			const mockLogger = createMockLogger();
			const errorSpy = vi.spyOn(mockLogger, 'error');
			const config: S3AuthConfig = {
				accessKey: undefined,
				secretKey: 'test-secret',
			};
			const middleware = createS3AuthMiddleware(config, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const res = await app.request('http://localhost/');

			expect(res.status).toBe(403);
			expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('S3 credentials not configured'));
		});
	});

	describe('authorization header authentication', () => {
		const mockLogger = createMockLogger();
		const config: S3AuthConfig = {
			accessKey: 'test-access-key',
			secretKey: 'test-secret-key',
		};

		it('should reject requests without auth header', async () => {
			const middleware = createS3AuthMiddleware(config, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const res = await app.request('http://localhost/');

			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).toContain('<Code>AccessDenied</Code>');
			expect(body).toContain('No valid authentication provided');
		});

		it('should reject requests with invalid authorization header format', async () => {
			const middleware = createS3AuthMiddleware(config, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const res = await app.request('http://localhost/', {
				headers: {
					authorization: 'InvalidFormat',
				},
			});

			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).toContain('<Code>AccessDenied</Code>');
		});

		it('should reject requests with wrong access key', async () => {
			const middleware = createS3AuthMiddleware(config, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const authHeader = `AWS4-HMAC-SHA256 Credential=wrong-key/20240101/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=abc123`;

			const res = await app.request('http://localhost/', {
				headers: {
					authorization: authHeader,
					'x-amz-date': '20240101T000000Z',
				},
			});

			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).toContain('<Code>InvalidAccessKeyId</Code>');
		});
	});

	describe('presigned URL authentication', () => {
		const mockLogger = createMockLogger();
		const config: S3AuthConfig = {
			accessKey: 'test-access-key',
			secretKey: 'test-secret-key',
		};

		it('should reject presigned URL with wrong access key', async () => {
			const middleware = createS3AuthMiddleware(config, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const url = new URL('http://localhost/');
			url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
			url.searchParams.set('X-Amz-Credential', 'wrong-key/20240101/us-east-1/s3/aws4_request');
			url.searchParams.set('X-Amz-Date', '20240101T000000Z');
			url.searchParams.set('X-Amz-Expires', '300');
			url.searchParams.set('X-Amz-SignedHeaders', 'host');
			url.searchParams.set('X-Amz-Signature', 'abc123');

			const res = await app.request(url.toString());

			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).toContain('<Code>InvalidAccessKeyId</Code>');
		});

		it('should reject presigned URL with missing parameters', async () => {
			const middleware = createS3AuthMiddleware(config, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const url = new URL('http://localhost/');
			url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');

			const res = await app.request(url.toString());

			expect(res.status).toBe(400);
			const body = await res.text();
			expect(body).toContain('<Code>InvalidArgument</Code>');
		});

		it('should reject expired presigned URL', async () => {
			const middleware = createS3AuthMiddleware(config, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/', () => new Response('OK'));

			const pastDate = new Date(Date.now() - 3600000);
			const amzDate = pastDate.toISOString().replace(/[:-]|\.\d+/g, '');

			const url = new URL('http://localhost/');
			url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
			url.searchParams.set('X-Amz-Credential', `${config.accessKey}/20240101/us-east-1/s3/aws4_request`);
			url.searchParams.set('X-Amz-Date', amzDate);
			url.searchParams.set('X-Amz-Expires', '1');
			url.searchParams.set('X-Amz-SignedHeaders', 'host');
			url.searchParams.set('X-Amz-Signature', 'abc123');

			const res = await app.request(url.toString());

			expect(res.status).toBe(403);
			const body = await res.text();
			expect(body).toContain('<Code>AccessDenied</Code>');
			expect(body).toContain('expired');
		});
	});

	describe('health endpoint bypass', () => {
		it('should allow health endpoint without authentication', async () => {
			const mockLogger = createMockLogger();
			const errorSpy = vi.spyOn(mockLogger, 'error');
			const middleware = createS3AuthMiddleware({}, mockLogger);
			const app = new Hono<HonoEnv>();
			app.use('*', middleware);
			app.get('/_health', () => new Response('OK'));

			const res = await app.request('http://localhost/_health');

			expect(res.status).toBe(200);
			expect(errorSpy).not.toHaveBeenCalled();
		});
	});
});
