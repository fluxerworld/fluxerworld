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

import {createAuthHarness, createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const HTTP_TOO_MANY_REQUESTS = 429;

interface RateLimitErrorResponse {
	code?: string;
	message?: string;
	global?: boolean;
	retry_after?: number;
}

interface UnauthorizedErrorResponse {
	code?: string;
	message?: string;
}

describe('Global API rate limit', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createAuthHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('revokes the auth session when an authenticated user hits the global rate limit', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.get('/users/@me')
			.header('x-fluxer-test-enable-rate-limits', 'true')
			.header('x-fluxer-test-global-rate-limit', '1')
			.expect(HTTP_STATUS.OK)
			.execute();

		const rateLimitError = await createBuilder<RateLimitErrorResponse>(harness, account.token)
			.get('/users/@me')
			.header('x-fluxer-test-enable-rate-limits', 'true')
			.header('x-fluxer-test-global-rate-limit', '1')
			.expect(HTTP_TOO_MANY_REQUESTS, APIErrorCodes.RATE_LIMITED)
			.execute();

		expect(rateLimitError.global).toBe(true);
		expect(typeof rateLimitError.retry_after).toBe('number');

		const unauth = await createBuilder<UnauthorizedErrorResponse>(harness, account.token)
			.get('/users/@me')
			.expect(HTTP_STATUS.UNAUTHORIZED, APIErrorCodes.UNAUTHORIZED)
			.execute();

		expect(unauth.code).toBe(APIErrorCodes.UNAUTHORIZED);
	});
});
