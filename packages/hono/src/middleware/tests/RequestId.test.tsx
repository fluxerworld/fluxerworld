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

import {Headers} from '@fluxer/constants/src/Headers';
import {REQUEST_ID_KEY, requestId} from '@fluxer/hono/src/middleware/RequestId';
import {Hono} from 'hono';
import {describe, expect, test, vi} from 'vitest';

type AppEnv = {
	Variables: {
		requestId: string;
	};
};

describe('RequestId Middleware', () => {
	test('generates a request ID when none provided', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', requestId());
		app.get('/test', (c) => {
			const id = c.get(REQUEST_ID_KEY);
			return c.json({requestId: id});
		});

		const response = await app.request('/test');
		expect(response.status).toBe(200);

		const responseId = response.headers.get(Headers.X_REQUEST_ID);
		expect(responseId).toBeTruthy();
		expect(responseId).toMatch(/^[0-9a-f-]{36}$/);

		const body = (await response.json()) as {requestId: string};
		expect(body.requestId).toBe(responseId);
	});

	test('uses existing request ID from header', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', requestId());
		app.get('/test', (c) => {
			const id = c.get(REQUEST_ID_KEY);
			return c.json({requestId: id});
		});

		const existingId = 'existing-request-id-12345';
		const response = await app.request('/test', {
			headers: {
				[Headers.X_REQUEST_ID]: existingId,
			},
		});

		expect(response.status).toBe(200);
		expect(response.headers.get(Headers.X_REQUEST_ID)).toBe(existingId);

		const body = (await response.json()) as {requestId: string};
		expect(body.requestId).toBe(existingId);
	});

	test('uses custom header name', async () => {
		const customHeader = 'X-Custom-Request-ID';
		const app = new Hono<AppEnv>();
		app.use('*', requestId({headerName: customHeader}));
		app.get('/test', (c) => {
			const id = c.get(REQUEST_ID_KEY);
			return c.json({requestId: id});
		});

		const existingId = 'custom-header-id';
		const response = await app.request('/test', {
			headers: {
				[customHeader]: existingId,
			},
		});

		expect(response.status).toBe(200);
		expect(response.headers.get(customHeader)).toBe(existingId);
	});

	test('uses custom generator function', async () => {
		const customGenerator = vi.fn().mockReturnValue('custom-generated-id');
		const app = new Hono<AppEnv>();
		app.use('*', requestId({generator: customGenerator}));
		app.get('/test', (c) => {
			const id = c.get(REQUEST_ID_KEY);
			return c.json({requestId: id});
		});

		const response = await app.request('/test');
		expect(response.status).toBe(200);
		expect(customGenerator).toHaveBeenCalled();
		expect(response.headers.get(Headers.X_REQUEST_ID)).toBe('custom-generated-id');
	});

	test('does not call generator when request ID exists', async () => {
		const customGenerator = vi.fn().mockReturnValue('custom-generated-id');
		const app = new Hono<AppEnv>();
		app.use('*', requestId({generator: customGenerator}));
		app.get('/test', (c) => c.json({ok: true}));

		await app.request('/test', {
			headers: {
				[Headers.X_REQUEST_ID]: 'existing-id',
			},
		});

		expect(customGenerator).not.toHaveBeenCalled();
	});

	test('does not set response header when setResponseHeader is false', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', requestId({setResponseHeader: false}));
		app.get('/test', (c) => c.json({ok: true}));

		const response = await app.request('/test');
		expect(response.status).toBe(200);
		expect(response.headers.get(Headers.X_REQUEST_ID)).toBeNull();
	});

	test('sets response header by default', async () => {
		const app = new Hono<AppEnv>();
		app.use('*', requestId());
		app.get('/test', (c) => c.json({ok: true}));

		const response = await app.request('/test');
		expect(response.status).toBe(200);
		expect(response.headers.get(Headers.X_REQUEST_ID)).toBeTruthy();
	});

	test('request ID is available in context after middleware runs', async () => {
		const app = new Hono<AppEnv>();
		let capturedId: string | undefined;
		app.use('*', requestId());
		app.get('/test', (c) => {
			capturedId = c.get(REQUEST_ID_KEY);
			return c.json({ok: true});
		});

		await app.request('/test');
		expect(capturedId).toBeTruthy();
		expect(capturedId).toMatch(/^[0-9a-f-]{36}$/);
	});

	test('different requests get different IDs', async () => {
		const app = new Hono<AppEnv>();
		const capturedIds: Array<string> = [];
		app.use('*', requestId());
		app.get('/test', (c) => {
			capturedIds.push(c.get(REQUEST_ID_KEY));
			return c.json({ok: true});
		});

		await app.request('/test');
		await app.request('/test');
		await app.request('/test');

		expect(capturedIds).toHaveLength(3);
		expect(new Set(capturedIds).size).toBe(3);
	});
});
