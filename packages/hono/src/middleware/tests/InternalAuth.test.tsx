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

import {createErrorHandler} from '@fluxer/hono/src/middleware/ErrorHandler';
import {createInternalAuth} from '@fluxer/hono/src/middleware/InternalAuth';
import {Hono} from 'hono';
import {describe, expect, test} from 'vitest';

interface ErrorResponse {
	code: string;
	message: string;
}

describe('InternalAuth Middleware', () => {
	const TEST_SECRET = 'test-secret-token';

	describe('missing authorization', () => {
		test('returns 401 when no Authorization header is present', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(401);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('UNAUTHORIZED');
			expect(body.message).toBe('Missing Authorization header');
		});
	});

	describe('invalid authorization format', () => {
		test('returns 401 when Authorization header does not start with Bearer', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test', {
				headers: {
					Authorization: 'Basic dXNlcjpwYXNz',
				},
			});
			expect(response.status).toBe(401);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('UNAUTHORIZED');
			expect(body.message).toBe('Invalid Authorization header format');
		});

		test('returns 401 when Authorization header is just Bearer without token', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test', {
				headers: {
					Authorization: 'Bearer',
				},
			});
			expect(response.status).toBe(401);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('UNAUTHORIZED');
			expect(body.message).toBe('Invalid Authorization header format');
		});
	});

	describe('invalid token', () => {
		test('returns 401 when token does not match secret', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test', {
				headers: {
					Authorization: 'Bearer wrong-token',
				},
			});
			expect(response.status).toBe(401);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('UNAUTHORIZED');
			expect(body.message).toBe('Invalid token');
		});

		test('returns 401 when token is empty after Bearer prefix', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test', {
				headers: {
					Authorization: 'Bearer ',
				},
			});
			expect(response.status).toBe(401);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('UNAUTHORIZED');
			expect(body.message).toBe('Invalid Authorization header format');
		});

		test('returns 401 when token has different length than secret', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test', {
				headers: {
					Authorization: 'Bearer short',
				},
			});
			expect(response.status).toBe(401);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('UNAUTHORIZED');
			expect(body.message).toBe('Invalid token');
		});
	});

	describe('valid token', () => {
		test('allows request through when token matches secret', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test', {
				headers: {
					Authorization: `Bearer ${TEST_SECRET}`,
				},
			});
			expect(response.status).toBe(200);

			const body = (await response.json()) as {ok: boolean};
			expect(body.ok).toBe(true);
		});

		test('allows POST requests with valid token', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.post('/test', (c) => c.json({created: true}));

			const response = await app.request('/test', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${TEST_SECRET}`,
				},
			});
			expect(response.status).toBe(200);

			const body = (await response.json()) as {created: boolean};
			expect(body.created).toBe(true);
		});
	});

	describe('skipPaths option', () => {
		test('skips auth for exact path match in skipPaths', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET, skipPaths: ['/public']}));
			app.onError(createErrorHandler());
			app.get('/public', (c) => c.json({ok: true}));

			const response = await app.request('/public');
			expect(response.status).toBe(200);

			const body = (await response.json()) as {ok: boolean};
			expect(body.ok).toBe(true);
		});

		test('skips auth for paths starting with skipPath prefix', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET, skipPaths: ['/public']}));
			app.onError(createErrorHandler());
			app.get('/public/nested', (c) => c.json({ok: true}));

			const response = await app.request('/public/nested');
			expect(response.status).toBe(200);

			const body = (await response.json()) as {ok: boolean};
			expect(body.ok).toBe(true);
		});

		test('does not skip auth for paths that do not match skipPaths', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET, skipPaths: ['/public']}));
			app.onError(createErrorHandler());
			app.get('/private', (c) => c.json({ok: true}));

			const response = await app.request('/private');
			expect(response.status).toBe(401);
		});

		test('supports multiple skipPaths', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET, skipPaths: ['/public', '/health']}));
			app.onError(createErrorHandler());
			app.get('/public', (c) => c.json({ok: true}));
			app.get('/health', (c) => c.json({ok: true}));
			app.get('/private', (c) => c.json({ok: true}));

			const publicResponse = await app.request('/public');
			expect(publicResponse.status).toBe(200);

			const healthResponse = await app.request('/health');
			expect(healthResponse.status).toBe(200);

			const privateResponse = await app.request('/private');
			expect(privateResponse.status).toBe(401);
		});
	});

	describe('default skipPaths', () => {
		test('default skipPaths includes /_health', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/_health', (c) => c.json({ok: true}));

			const response = await app.request('/_health');
			expect(response.status).toBe(200);

			const body = (await response.json()) as {ok: boolean};
			expect(body.ok).toBe(true);
		});

		test('default skipPaths allows nested /_health paths', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/_health/detailed', (c) => c.json({ok: true}));

			const response = await app.request('/_health/detailed');
			expect(response.status).toBe(200);

			const body = (await response.json()) as {ok: boolean};
			expect(body.ok).toBe(true);
		});

		test('default skipPaths still requires auth for non-health paths', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/api', (c) => c.json({ok: true}));

			const response = await app.request('/api');
			expect(response.status).toBe(401);
		});
	});

	describe('multiple routes', () => {
		test('handles multiple routes with proper auth', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/api/users', (c) => c.json({users: []}));
			app.get('/api/posts', (c) => c.json({posts: []}));

			const usersResponse = await app.request('/api/users', {
				headers: {Authorization: `Bearer ${TEST_SECRET}`},
			});
			expect(usersResponse.status).toBe(200);

			const postsResponse = await app.request('/api/posts', {
				headers: {Authorization: `Bearer ${TEST_SECRET}`},
			});
			expect(postsResponse.status).toBe(200);
		});
	});

	describe('error recovery', () => {
		test('does not affect subsequent successful requests', async () => {
			const app = new Hono();
			app.use('*', createInternalAuth({secret: TEST_SECRET}));
			app.onError(createErrorHandler());
			app.get('/test', (c) => c.json({ok: true}));

			const errorResponse = await app.request('/test');
			expect(errorResponse.status).toBe(401);

			const successResponse = await app.request('/test', {
				headers: {Authorization: `Bearer ${TEST_SECRET}`},
			});
			expect(successResponse.status).toBe(200);
		});
	});
});
