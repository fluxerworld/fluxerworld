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
	createEmoji,
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

describe('Emoji upload validation', () => {
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

	it('successfully creates an emoji with a valid GIF image', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		const emoji = await createEmoji(harness, user.token, guild.id, {
			name: 'animated_emoji',
			image: getGifDataUrl(VALID_GIF_BASE64),
		});

		expect(emoji.name).toBe('animated_emoji');
		expect(emoji.id).toBeDefined();
	});

	it('accepts emoji name with underscores', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		const emoji = await createEmoji(harness, user.token, guild.id, {
			name: 'test_emoji_name',
			image: getPngDataUrl(VALID_PNG_BASE64),
		});

		expect(emoji.name).toBe('test_emoji_name');
		expect(emoji.id).toBeDefined();
	});

	it('rejects emoji name with special characters', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'test@emoji!',
				image: getPngDataUrl(VALID_PNG_BASE64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji name that is too short (< 2 characters)', async () => {
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

	it('rejects emoji name that is too long (> 32 characters)', async () => {
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

	it('rejects emoji with corrupted image data', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		const corruptedBase64 = Buffer.from('not-an-image').toString('base64');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'corrupted_emoji',
				image: getPngDataUrl(corruptedBase64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji that exceeds size limit (384KB)', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		const largeData = 'A'.repeat(384 * 1024 + 10000);
		const largeBase64 = Buffer.from(largeData).toString('base64');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'large_emoji',
				image: getPngDataUrl(largeBase64),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects emoji with invalid base64 encoding', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Emoji Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'invalid_emoji',
				image: 'data:image/png;base64,not-valid-base64!!!',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
