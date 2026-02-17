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

import {createOAuth2Client, OAuth2Client} from '@fluxer/oauth2/src/client/OAuth2Client';
import type {OAuth2ClientConfig, OAuth2ClientEndpoints} from '@fluxer/oauth2/src/config/OAuth2ClientConfig';
import type {IOAuth2HttpClient} from '@fluxer/oauth2/src/http/IOAuth2HttpClient';
import type {IOAuth2Logger} from '@fluxer/oauth2/src/logging/IOAuth2Logger';
import type {OAuth2TokenResponse} from '@fluxer/oauth2/src/models/OAuth2TokenResponse';
import type {OAuth2UserInfo} from '@fluxer/oauth2/src/models/OAuth2UserInfo';
import {describe, expect, it} from 'vitest';

interface LoggerMethodCalls {
	debug: Array<Array<unknown>>;
	info: Array<Array<unknown>>;
	warn: Array<Array<unknown>>;
	error: Array<Array<unknown>>;
}

interface TestLogger extends IOAuth2Logger {
	calls: LoggerMethodCalls;
}

interface OAuth2ClientConfigOverrides extends Partial<Omit<OAuth2ClientConfig, 'endpoints'>> {
	endpoints?: Partial<OAuth2ClientEndpoints>;
}

interface RequestCall {
	url: string;
	init: RequestInit | undefined;
}

class TestHttpClient implements IOAuth2HttpClient {
	public readonly calls: Array<RequestCall> = [];
	private readonly queue: Array<unknown> = [];

	enqueueResponse(response: Response): void {
		this.queue.push(response);
	}

	enqueueError(error: unknown): void {
		this.queue.push(error);
	}

	async request(url: string, init?: RequestInit): Promise<Response> {
		this.calls.push({url, init});
		const next = this.queue.shift();

		if (next === undefined) {
			throw new Error('TestHttpClient request queue is empty');
		}

		if (next instanceof Response) {
			return next;
		}

		throw next;
	}
}

function createTestConfig(overrides?: OAuth2ClientConfigOverrides): OAuth2ClientConfig {
	const endpoints: OAuth2ClientEndpoints = {
		authorizeEndpoint: overrides?.endpoints?.authorizeEndpoint ?? 'https://auth.example.com/authorize',
		tokenEndpoint: overrides?.endpoints?.tokenEndpoint ?? 'https://auth.example.com/token',
		userInfoEndpoint: overrides?.endpoints?.userInfoEndpoint ?? 'https://api.example.com/users/@me',
		revokeEndpoint: overrides?.endpoints?.revokeEndpoint ?? 'https://auth.example.com/revoke',
	};

	return {
		clientId: overrides?.clientId ?? 'test-client-id',
		clientSecret: overrides?.clientSecret ?? 'test-client-secret',
		redirectUri: overrides?.redirectUri ?? 'https://example.com/callback',
		scope: overrides?.scope ?? 'identify email admin',
		endpoints,
	};
}

function createTestTokenResponse(overrides?: Partial<OAuth2TokenResponse>): OAuth2TokenResponse {
	return {
		access_token: 'test-access-token',
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: 'test-refresh-token',
		scope: 'identify email admin',
		...overrides,
	};
}

function createTestUserInfo(overrides?: Partial<OAuth2UserInfo>): OAuth2UserInfo {
	return {
		id: '123456789',
		username: 'test-user',
		discriminator: 4242,
		avatar: 'avatar-hash',
		email: 'test@example.com',
		acls: ['admin:authenticate'],
		...overrides,
	};
}

function createTestLogger(): TestLogger {
	const calls: LoggerMethodCalls = {
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

function getBodyAsSearchParams(init?: RequestInit): URLSearchParams {
	if (init?.body instanceof URLSearchParams) {
		return init.body;
	}

	throw new Error('Expected request body to be URLSearchParams');
}

function getAuthorizationHeader(init?: RequestInit): string | null {
	const headers = new Headers(init?.headers);
	return headers.get('Authorization');
}

describe('OAuth2Client', () => {
	it('should create an OAuth2Client instance via the factory', () => {
		const client = createOAuth2Client(createTestConfig());
		expect(client).toBeInstanceOf(OAuth2Client);
	});

	it('should generate URL-safe state values with stable length', () => {
		const client = createOAuth2Client(createTestConfig());
		const firstState = client.generateState();
		const secondState = client.generateState();

		expect(firstState).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(firstState.length).toBe(43);
		expect(firstState).not.toBe(secondState);
	});

	it('should build an authorization URL and preserve existing query params', () => {
		const client = createOAuth2Client(
			createTestConfig({
				endpoints: {
					authorizeEndpoint: 'https://auth.example.com/authorize?existing=value',
				},
			}),
		);

		const url = new URL(client.createAuthorizationUrl('state+with/special=chars'));

		expect(url.origin).toBe('https://auth.example.com');
		expect(url.pathname).toBe('/authorize');
		expect(url.searchParams.get('existing')).toBe('value');
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('client_id')).toBe('test-client-id');
		expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
		expect(url.searchParams.get('scope')).toBe('identify email admin');
		expect(url.searchParams.get('state')).toBe('state+with/special=chars');
	});

	it('should exchange an authorization code for tokens', async () => {
		const config = createTestConfig();
		const tokenResponse = createTestTokenResponse();
		const httpClient = new TestHttpClient();
		httpClient.enqueueResponse(
			new Response(JSON.stringify(tokenResponse), {
				status: 200,
				headers: {'Content-Type': 'application/json'},
			}),
		);

		const client = createOAuth2Client(config, {httpClient});
		const result = await client.exchangeCodeForToken('auth-code-123');

		expect(result).toEqual(tokenResponse);
		expect(httpClient.calls.length).toBe(1);
		expect(httpClient.calls[0]?.url).toBe(config.endpoints.tokenEndpoint);
		expect(httpClient.calls[0]?.init?.method).toBe('POST');

		const body = getBodyAsSearchParams(httpClient.calls[0]?.init);
		expect(body.get('grant_type')).toBe('authorization_code');
		expect(body.get('code')).toBe('auth-code-123');
		expect(body.get('redirect_uri')).toBe(config.redirectUri);
		expect(body.get('client_id')).toBe(config.clientId);
		expect(body.get('client_secret')).toBe(config.clientSecret);
	});

	it('should return null and log a warning when token exchange fails', async () => {
		const config = createTestConfig();
		const logger = createTestLogger();
		const httpClient = new TestHttpClient();
		httpClient.enqueueResponse(new Response(null, {status: 401}));

		const client = createOAuth2Client(config, {httpClient, logger});
		const result = await client.exchangeCodeForToken('bad-code');

		expect(result).toBeNull();
		expect(logger.calls.warn).toEqual([
			[{status: 401, tokenEndpoint: config.endpoints.tokenEndpoint}, 'OAuth2 code exchange failed'],
		]);
	});

	it('should return null and log errors when token exchange throws', async () => {
		const config = createTestConfig();
		const logger = createTestLogger();
		const httpClient = new TestHttpClient();
		httpClient.enqueueError(new Error('Network timeout'));

		const client = createOAuth2Client(config, {httpClient, logger});
		const result = await client.exchangeCodeForToken('auth-code');

		expect(result).toBeNull();
		expect(logger.calls.error).toEqual([
			[{error: 'Network timeout', tokenEndpoint: config.endpoints.tokenEndpoint}, 'OAuth2 code exchange error'],
		]);
	});

	it('should fetch the current user', async () => {
		const config = createTestConfig();
		const userInfo = createTestUserInfo();
		const httpClient = new TestHttpClient();
		httpClient.enqueueResponse(
			new Response(JSON.stringify(userInfo), {
				status: 200,
				headers: {'Content-Type': 'application/json'},
			}),
		);

		const client = createOAuth2Client(config, {httpClient});
		const result = await client.fetchCurrentUser('test-access-token');

		expect(result).toEqual(userInfo);
		expect(httpClient.calls.length).toBe(1);
		expect(httpClient.calls[0]?.url).toBe(config.endpoints.userInfoEndpoint);
		expect(getAuthorizationHeader(httpClient.calls[0]?.init)).toBe('Bearer test-access-token');
	});

	it('should return null and log errors when user fetch throws', async () => {
		const config = createTestConfig();
		const logger = createTestLogger();
		const httpClient = new TestHttpClient();
		httpClient.enqueueError('string error');

		const client = createOAuth2Client(config, {httpClient, logger});
		const result = await client.fetchCurrentUser('test-access-token');

		expect(result).toBeNull();
		expect(logger.calls.error).toEqual([
			[{error: 'string error', userInfoEndpoint: config.endpoints.userInfoEndpoint}, 'OAuth2 user fetch error'],
		]);
	});

	it('should revoke a token with basic auth credentials', async () => {
		const config = createTestConfig();
		const httpClient = new TestHttpClient();
		httpClient.enqueueResponse(new Response(null, {status: 200}));

		const client = createOAuth2Client(config, {httpClient});
		await client.revokeAccessToken('token-to-revoke');

		expect(httpClient.calls.length).toBe(1);
		expect(httpClient.calls[0]?.url).toBe(config.endpoints.revokeEndpoint);
		expect(httpClient.calls[0]?.init?.method).toBe('POST');

		const authorizationHeader = getAuthorizationHeader(httpClient.calls[0]?.init);
		expect(authorizationHeader).toMatch(/^Basic /);
		const encodedCredentials = authorizationHeader?.replace('Basic ', '') ?? '';
		const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString();
		expect(decodedCredentials).toBe(`${config.clientId}:${config.clientSecret}`);

		const body = getBodyAsSearchParams(httpClient.calls[0]?.init);
		expect(body.get('token')).toBe('token-to-revoke');
		expect(body.get('token_type_hint')).toBe('access_token');
	});

	it('should log warnings when revocation fails with non-ok status', async () => {
		const config = createTestConfig();
		const logger = createTestLogger();
		const httpClient = new TestHttpClient();
		httpClient.enqueueResponse(new Response(null, {status: 500}));

		const client = createOAuth2Client(config, {httpClient, logger});
		await client.revokeAccessToken('token-to-revoke');

		expect(logger.calls.warn).toEqual([
			[{status: 500, revokeEndpoint: config.endpoints.revokeEndpoint}, 'OAuth2 token revocation failed'],
		]);
	});

	it('should log warnings when revocation throws', async () => {
		const config = createTestConfig();
		const logger = createTestLogger();
		const httpClient = new TestHttpClient();
		httpClient.enqueueError(new Error('Connection reset'));

		const client = createOAuth2Client(config, {httpClient, logger});
		await client.revokeAccessToken('token-to-revoke');

		expect(logger.calls.warn).toEqual([
			[{error: 'Connection reset', revokeEndpoint: config.endpoints.revokeEndpoint}, 'OAuth2 token revocation failed'],
		]);
	});
});
