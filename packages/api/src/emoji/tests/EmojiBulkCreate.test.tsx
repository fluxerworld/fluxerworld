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
import {createTestGuild, getPngDataUrl, VALID_PNG_BASE64} from '@fluxer/api/src/emoji/tests/EmojiTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Emoji bulk creation', () => {
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

	it('successfully bulk creates multiple emojis', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		const emojis = Array.from({length: 5}, (_, i) => ({
			name: `bulk_emoji_${i + 1}`,
			image: getPngDataUrl(VALID_PNG_BASE64),
		}));

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis/bulk`)
			.body({emojis})
			.expect(HTTP_STATUS.OK)
			.execute();
	});
});
