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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Theme validation', () => {
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

	it('rejects request with missing css field', async () => {
		const user = await createTestAccount(harness);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects request with empty css string', async () => {
		const user = await createTestAccount(harness);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({css: ''})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects request with null css value', async () => {
		const user = await createTestAccount(harness);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({css: null})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects request with numeric css value', async () => {
		const user = await createTestAccount(harness);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({css: 12345})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects request with array css value', async () => {
		const user = await createTestAccount(harness);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({css: ['body { color: red; }']})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects request with object css value', async () => {
		const user = await createTestAccount(harness);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({css: {content: 'body { color: red; }'}})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects request with boolean css value', async () => {
		const user = await createTestAccount(harness);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({css: true})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
