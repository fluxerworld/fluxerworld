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

import {fetchUser, type LoggerInterface, type UserInfo} from '@fluxer/oauth2/src/User';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const TEST_API_ENDPOINT = 'https://api.example.com';
const TEST_ACCESS_TOKEN = 'test-access-token-123';

function createTestUser(overrides?: Partial<UserInfo>): UserInfo {
	return {
		id: '123456789',
		username: 'testuser',
		discriminator: 1234,
		avatar: 'abc123def456',
		email: 'test@example.com',
		acls: ['admin', 'moderator'],
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

describe('fetchUser', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('should fetch user info successfully', async () => {
		const testUser = createTestUser();
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(testUser),
		});

		const user = await fetchUser(TEST_API_ENDPOINT, TEST_ACCESS_TOKEN);

		expect(user).toEqual(testUser);
		expect(globalThis.fetch).toHaveBeenCalledWith(`${TEST_API_ENDPOINT}/users/@me`, {
			headers: {
				Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
			},
		});
	});

	it('should return null on non-ok response', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
		});

		const user = await fetchUser(TEST_API_ENDPOINT, TEST_ACCESS_TOKEN);

		expect(user).toBeNull();
	});

	it('should log warning on non-ok response when logger provided', async () => {
		const logger = createTestLogger();
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
		});

		await fetchUser(TEST_API_ENDPOINT, TEST_ACCESS_TOKEN, {logger});

		expect(logger.calls.warn.length).toBe(1);
		expect(logger.calls.warn[0]).toEqual([{status: 403, apiEndpoint: TEST_API_ENDPOINT}, 'OAuth2 user fetch failed']);
	});

	it('should return null on network error', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

		const user = await fetchUser(TEST_API_ENDPOINT, TEST_ACCESS_TOKEN);

		expect(user).toBeNull();
	});

	it('should log error on fetch exception when logger provided', async () => {
		const logger = createTestLogger();
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

		await fetchUser(TEST_API_ENDPOINT, TEST_ACCESS_TOKEN, {logger});

		expect(logger.calls.error.length).toBe(1);
		expect(logger.calls.error[0]).toEqual([
			{error: 'Connection refused', apiEndpoint: TEST_API_ENDPOINT},
			'OAuth2 user fetch error',
		]);
	});

	it('should handle non-Error exceptions', async () => {
		const logger = createTestLogger();
		globalThis.fetch = vi.fn().mockRejectedValue('string error');

		await fetchUser(TEST_API_ENDPOINT, TEST_ACCESS_TOKEN, {logger});

		expect(logger.calls.error.length).toBe(1);
		expect(logger.calls.error[0]).toEqual([
			{error: 'string error', apiEndpoint: TEST_API_ENDPOINT},
			'OAuth2 user fetch error',
		]);
	});

	it('should fetch user without logger option', async () => {
		const testUser = createTestUser();
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(testUser),
		});

		const user = await fetchUser(TEST_API_ENDPOINT, TEST_ACCESS_TOKEN);

		expect(user).toEqual(testUser);
	});

	it('should handle user with minimal fields', async () => {
		const minimalUser: UserInfo = {
			id: '111',
			username: 'minimal',
			discriminator: 0,
			avatar: null,
		};
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(minimalUser),
		});

		const user = await fetchUser(TEST_API_ENDPOINT, TEST_ACCESS_TOKEN);

		expect(user).toEqual(minimalUser);
		expect(user?.email).toBeUndefined();
		expect(user?.acls).toBeUndefined();
	});
});
