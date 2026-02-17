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

import {createFakeAuthToken} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Theme authentication required', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('rejects request without authentication', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/users/@me/themes')
			.body({css: '.test { color: red; }'})
			.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
			.execute();
	});

	it('rejects request with invalid token', async () => {
		const fakeToken = createFakeAuthToken();

		await createBuilder(harness, fakeToken)
			.post('/users/@me/themes')
			.body({css: '.test { color: red; }'})
			.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
			.execute();
	});

	it('rejects request with empty authorization header', async () => {
		await createBuilder(harness, '')
			.post('/users/@me/themes')
			.body({css: '.test { color: red; }'})
			.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
			.execute();
	});

	it('rejects request with malformed token', async () => {
		await createBuilder(harness, 'not-a-valid-token')
			.post('/users/@me/themes')
			.body({css: '.test { color: red; }'})
			.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
			.execute();
	});
});
