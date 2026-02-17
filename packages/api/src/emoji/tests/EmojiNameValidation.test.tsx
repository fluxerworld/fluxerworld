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

describe('Emoji name validation', () => {
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

	it('accepts emoji name with underscores', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'test_emoji_name',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	it('rejects emoji name that is too long (>32 characters)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'a'.repeat(33),
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji name that is too short (<2 characters)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'a',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji name with spaces', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'test emoji',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji name with hyphens', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'test-emoji',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji name with dots', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'test.emoji',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji name with special characters (@)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'test@emoji',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji name with special characters (!)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'test!emoji',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji name with special characters (#)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'test#emoji',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
