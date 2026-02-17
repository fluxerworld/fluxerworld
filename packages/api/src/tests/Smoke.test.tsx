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

import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {describe, expect, it} from 'vitest';

describe('Smoke Tests', () => {
	it('health endpoint responds with OK', async () => {
		const harness = await createApiTestHarness();

		try {
			const {response, text} = await createBuilderWithoutAuth(harness)
				.get('/_health')
				.expect(HTTP_STATUS.OK)
				.executeRaw();

			expect(response.status).toBe(HTTP_STATUS.OK);
			expect(text.trim()).toBe('OK');
		} finally {
			await harness?.shutdown();
		}
	});
});
