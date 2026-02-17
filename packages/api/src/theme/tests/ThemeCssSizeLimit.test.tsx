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
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface ThemeCreateResponse {
	id: string;
}

const MAX_CSS_BYTES = 8 * 1024 * 1024;

describe('Theme CSS size limits', () => {
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

	it('rejects CSS that exceeds the 8MB limit', async () => {
		const user = await createTestAccount(harness);

		const oversizedCss = 'a'.repeat(MAX_CSS_BYTES + 1);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({css: oversizedCss})
			.expect(HTTP_STATUS.BAD_REQUEST, 'FILE_SIZE_TOO_LARGE')
			.execute();
	});

	it('accepts CSS at exactly the 8MB limit', async () => {
		const user = await createTestAccount(harness);

		const maxCss = 'a'.repeat(MAX_CSS_BYTES);

		const theme = await createBuilder<ThemeCreateResponse>(harness, user.token)
			.post('/users/@me/themes')
			.body({css: maxCss})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		expect(theme.id).toBeDefined();
	});

	it('accepts CSS just under the 8MB limit', async () => {
		const user = await createTestAccount(harness);

		const nearMaxCss = 'a'.repeat(MAX_CSS_BYTES - 1);

		const theme = await createBuilder<ThemeCreateResponse>(harness, user.token)
			.post('/users/@me/themes')
			.body({css: nearMaxCss})
			.expect(HTTP_STATUS.CREATED)
			.execute();

		expect(theme.id).toBeDefined();
	});

	it('rejects CSS exceeding limit with multibyte unicode characters', async () => {
		const user = await createTestAccount(harness);

		const unicodeChar = '\u{1F600}';
		const bytesPerChar = Buffer.from(unicodeChar, 'utf-8').length;
		const charsNeeded = Math.ceil((MAX_CSS_BYTES + 1) / bytesPerChar);
		const oversizedUnicodeCss = unicodeChar.repeat(charsNeeded);

		await createBuilder(harness, user.token)
			.post('/users/@me/themes')
			.body({css: oversizedUnicodeCss})
			.expect(HTTP_STATUS.BAD_REQUEST, 'FILE_SIZE_TOO_LARGE')
			.execute();
	});
});
