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
import {
	createTestGuild,
	getGifDataUrl,
	getPngDataUrl,
	VALID_GIF_BASE64,
	VALID_PNG_BASE64,
} from '@fluxer/api/src/emoji/tests/EmojiTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Sticker upload validation', () => {
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

	it('successfully creates a sticker with valid PNG image, description, and tags', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const sticker = await createBuilder<{id: string; name: string}>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'test_sticker',
				description: 'A test sticker',
				tags: ['test', 'sticker'],
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(sticker.name).toBe('test_sticker');
		expect(sticker.id).toBeDefined();
	});

	it('successfully creates a sticker with valid GIF image', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const sticker = await createBuilder<{id: string; name: string}>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'animated_sticker',
				image: getGifDataUrl(VALID_GIF_BASE64),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(sticker.name).toBe('animated_sticker');
	});

	it('rejects sticker that exceeds size limit (512KB)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const largeData = 'A'.repeat(512 * 1024 + 10000);
		const largeBase64 = Buffer.from(largeData).toString('base64');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'large_sticker',
				image: getPngDataUrl(largeBase64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects sticker with description too long (>500 characters)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'test_sticker',
				description: 'a'.repeat(501),
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects sticker with tag too long (>30 characters)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'test_sticker',
				tags: ['a'.repeat(31)],
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects sticker with too many tags (>200 tags)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'test_sticker',
				tags: Array.from({length: 201}, () => 'tag'),
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects sticker with name too long (>32 characters)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'a'.repeat(33),
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('allows sticker names with spaces', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'test sticker',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	it('rejects sticker with invalid base64 encoding', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'invalid_sticker',
				image: 'data:image/png;base64,not-valid-base64!!!',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
