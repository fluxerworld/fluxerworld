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

import {createAuthHarness} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Auth desktop handoff negative paths', () => {
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

	it('rejects unknown handoff code on status endpoint', async () => {
		await createBuilderWithoutAuth(harness)
			.get('/auth/handoff/unknown-code/status')
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.INVALID_HANDOFF_CODE)
			.execute();
	});

	it('rejects handoff complete with bad token', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/auth/handoff/complete')
			.body({
				code: 'bad-code',
				token: 'bad-token',
				user_id: '123',
			})
			.expect(HTTP_STATUS.UNAUTHORIZED, 'INVALID_TOKEN')
			.execute();
	});

	it('handles cancel for unknown handoff code gracefully', async () => {
		await createBuilderWithoutAuth(harness)
			.delete('/auth/handoff/unknown-code')
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.INVALID_HANDOFF_CODE)
			.execute();
	});
});
