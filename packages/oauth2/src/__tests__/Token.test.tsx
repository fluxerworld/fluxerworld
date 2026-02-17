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

import type {OAuth2Config} from '@fluxer/oauth2/src/OAuth2';
import {exchangeCode, type LoggerInterface, revokeToken, type TokenResponse} from '@fluxer/oauth2/src/Token';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

function createTestConfig(overrides?: Partial<OAuth2Config>): OAuth2Config {
	return {
		clientId: 'test-client-id',
		clientSecret: 'test-client-secret',
		redirectUri: 'https://example.com/callback',
		authorizeEndpoint: 'https://auth.example.com/authorize',
		tokenEndpoint: 'https://auth.example.com/token',
		scope: 'openid profile email',
		...overrides,
	};
}

function createTestTokenResponse(overrides?: Partial<TokenResponse>): TokenResponse {
	return {
		access_token: 'test-access-token',
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: 'test-refresh-token',
		scope: 'openid profile email',
		...overrides,
	};
}

function createTestLogger(): LoggerInterface & {calls: Record<string, Array<unknown>>} {
	const calls: Record<string, Array<unknown>> = {
		debug: [],
		info: [],
		warn: [],
		error: [],
	};
	return {
		calls,
		debug: (...args: Array<unknown>) => calls.debug.push(args),
		info: (...args: Array<unknown>) => calls.info.push(args),
		warn: (...args: Array<unknown>) => calls.warn.push(args),
		error: (...args: Array<unknown>) => calls.error.push(args),
	};
}

describe('exchangeCode', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('should exchange code for tokens successfully', async () => {
		const config = createTestConfig();
		const tokenResponse = createTestTokenResponse();

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(tokenResponse),
		});

		const result = await exchangeCode(config, 'authorization-code');

		expect(result).toEqual(tokenResponse);
		expect(globalThis.fetch).toHaveBeenCalledWith(config.tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: expect.any(URLSearchParams),
		});
	});

	it('should send correct form data in request body', async () => {
		const config = createTestConfig();
		let capturedBody: URLSearchParams | undefined;

		globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
			capturedBody = options?.body as URLSearchParams;
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve(createTestTokenResponse()),
			});
		});

		await exchangeCode(config, 'test-auth-code');

		expect(capturedBody).toBeDefined();
		expect(capturedBody?.get('grant_type')).toBe('authorization_code');
		expect(capturedBody?.get('code')).toBe('test-auth-code');
		expect(capturedBody?.get('redirect_uri')).toBe(config.redirectUri);
		expect(capturedBody?.get('client_id')).toBe(config.clientId);
		expect(capturedBody?.get('client_secret')).toBe(config.clientSecret);
	});

	it('should return null on non-ok response', async () => {
		const config = createTestConfig();
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
		});

		const result = await exchangeCode(config, 'invalid-code');

		expect(result).toBeNull();
	});

	it('should log warning on non-ok response when logger provided', async () => {
		const config = createTestConfig();
		const logger = createTestLogger();

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
		});

		await exchangeCode(config, 'invalid-code', {logger});

		expect(logger.calls.warn.length).toBe(1);
		expect(logger.calls.warn[0]).toEqual([
			{status: 401, tokenEndpoint: config.tokenEndpoint},
			'OAuth2 code exchange failed',
		]);
	});

	it('should return null on network error', async () => {
		const config = createTestConfig();
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		const result = await exchangeCode(config, 'auth-code');

		expect(result).toBeNull();
	});

	it('should log error on fetch exception when logger provided', async () => {
		const config = createTestConfig();
		const logger = createTestLogger();

		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection timeout'));

		await exchangeCode(config, 'auth-code', {logger});

		expect(logger.calls.error.length).toBe(1);
		expect(logger.calls.error[0]).toEqual([
			{error: 'Connection timeout', tokenEndpoint: config.tokenEndpoint},
			'OAuth2 code exchange error',
		]);
	});

	it('should handle non-Error exceptions', async () => {
		const config = createTestConfig();
		const logger = createTestLogger();

		globalThis.fetch = vi.fn().mockRejectedValue({code: 'ECONNREFUSED'});

		await exchangeCode(config, 'auth-code', {logger});

		expect(logger.calls.error.length).toBe(1);
		expect(logger.calls.error[0]).toEqual([
			{error: '[object Object]', tokenEndpoint: config.tokenEndpoint},
			'OAuth2 code exchange error',
		]);
	});

	it('should handle token response without refresh_token', async () => {
		const config = createTestConfig();
		const tokenResponse: TokenResponse = {
			access_token: 'test-access-token',
			token_type: 'Bearer',
			expires_in: 3600,
			scope: 'openid',
		};

		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(tokenResponse),
		});

		const result = await exchangeCode(config, 'auth-code');

		expect(result).toEqual(tokenResponse);
		expect(result?.refresh_token).toBeUndefined();
	});
});

describe('revokeToken', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('should revoke token with correct authorization header', async () => {
		const config = createTestConfig();
		const revokeEndpoint = 'https://auth.example.com/revoke';
		let capturedHeaders: Headers | Record<string, string> | undefined;

		globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
			capturedHeaders = options?.headers;
			return Promise.resolve({ok: true});
		});

		await revokeToken(config, 'token-to-revoke', revokeEndpoint);

		expect(globalThis.fetch).toHaveBeenCalledWith(revokeEndpoint, expect.any(Object));
		const authHeader = (capturedHeaders as Record<string, string>)?.Authorization;
		expect(authHeader).toMatch(/^Basic /);

		const base64Creds = authHeader?.replace('Basic ', '');
		const decoded = Buffer.from(base64Creds ?? '', 'base64').toString();
		expect(decoded).toBe(`${config.clientId}:${config.clientSecret}`);
	});

	it('should send correct form data in request body', async () => {
		const config = createTestConfig();
		const revokeEndpoint = 'https://auth.example.com/revoke';
		let capturedBody: URLSearchParams | undefined;

		globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
			capturedBody = options?.body as URLSearchParams;
			return Promise.resolve({ok: true});
		});

		await revokeToken(config, 'access-token-123', revokeEndpoint);

		expect(capturedBody).toBeDefined();
		expect(capturedBody?.get('token')).toBe('access-token-123');
		expect(capturedBody?.get('token_type_hint')).toBe('access_token');
	});

	it('should use POST method with correct content type', async () => {
		const config = createTestConfig();
		const revokeEndpoint = 'https://auth.example.com/revoke';
		let capturedOptions: RequestInit | undefined;

		globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
			capturedOptions = options;
			return Promise.resolve({ok: true});
		});

		await revokeToken(config, 'token', revokeEndpoint);

		expect(capturedOptions?.method).toBe('POST');
		expect((capturedOptions?.headers as Record<string, string>)?.['Content-Type']).toBe(
			'application/x-www-form-urlencoded',
		);
	});

	it('should not throw on network error', async () => {
		const config = createTestConfig();
		const revokeEndpoint = 'https://auth.example.com/revoke';

		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		await expect(revokeToken(config, 'token', revokeEndpoint)).resolves.toBeUndefined();
	});

	it('should log warning on network error when logger provided', async () => {
		const config = createTestConfig();
		const revokeEndpoint = 'https://auth.example.com/revoke';
		const logger = createTestLogger();

		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

		await revokeToken(config, 'token', revokeEndpoint, {logger});

		expect(logger.calls.warn.length).toBe(1);
		expect(logger.calls.warn[0]).toEqual([
			{error: 'Connection refused', revokeEndpoint},
			'OAuth2 token revocation failed',
		]);
	});

	it('should handle non-Error exceptions', async () => {
		const config = createTestConfig();
		const revokeEndpoint = 'https://auth.example.com/revoke';
		const logger = createTestLogger();

		globalThis.fetch = vi.fn().mockRejectedValue('string error');

		await revokeToken(config, 'token', revokeEndpoint, {logger});

		expect(logger.calls.warn.length).toBe(1);
		expect(logger.calls.warn[0]).toEqual([{error: 'string error', revokeEndpoint}, 'OAuth2 token revocation failed']);
	});

	it('should not log when revocation succeeds', async () => {
		const config = createTestConfig();
		const revokeEndpoint = 'https://auth.example.com/revoke';
		const logger = createTestLogger();

		globalThis.fetch = vi.fn().mockResolvedValue({ok: true});

		await revokeToken(config, 'token', revokeEndpoint, {logger});

		expect(logger.calls.warn.length).toBe(0);
		expect(logger.calls.error.length).toBe(0);
	});

	it('should work without logger option', async () => {
		const config = createTestConfig();
		const revokeEndpoint = 'https://auth.example.com/revoke';

		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Error'));

		await expect(revokeToken(config, 'token', revokeEndpoint)).resolves.toBeUndefined();
	});
});
