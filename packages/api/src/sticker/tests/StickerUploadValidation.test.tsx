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
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const VALID_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const VALID_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function getPngDataUrl(base64: string = VALID_PNG_BASE64): string {
	return `data:image/png;base64,${base64}`;
}

function getGifDataUrl(base64: string = VALID_GIF_BASE64): string {
	return `data:image/gif;base64,${base64}`;
}

interface StickerResponse {
	id: string;
	name: string;
	description: string;
	tags: Array<string>;
}

async function createTestGuild(harness: ApiTestHarness, token: string, name: string): Promise<GuildResponse> {
	return createBuilder<GuildResponse>(harness, token).post('/guilds').body({name}).execute();
}

describe('Sticker Upload Validation', () => {
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

	it('valid sticker upload succeeds with PNG image', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const sticker = await createBuilder<StickerResponse>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'validsticker',
				description: 'A valid test sticker',
				tags: ['test', 'valid'],
				image: getPngDataUrl(),
			})
			.expect(200)
			.execute();

		expect(sticker.id).toBeDefined();
		expect(sticker.name).toBe('validsticker');
		expect(sticker.description).toBe('A valid test sticker');
		expect(sticker.tags).toEqual(['test', 'valid']);
	});

	it('valid sticker upload succeeds with GIF image', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const sticker = await createBuilder<StickerResponse>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'animatedsticker',
				description: 'An animated sticker',
				tags: ['animated'],
				image: getGifDataUrl(),
			})
			.expect(200)
			.execute();

		expect(sticker.id).toBeDefined();
		expect(sticker.name).toBe('animatedsticker');
	});

	it('sticker name too long is rejected', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'a'.repeat(31),
				image: getPngDataUrl(),
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('sticker name too short is rejected', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'a',
				image: getPngDataUrl(),
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('sticker tag too long is rejected', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'validname',
				tags: ['a'.repeat(31)],
				image: getPngDataUrl(),
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('too many tags is rejected', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'validname',
				tags: Array.from({length: 11}, (_, i) => `tag${i}`),
				image: getPngDataUrl(),
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('invalid description is rejected when exceeding max length', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'validname',
				description: 'a'.repeat(501),
				image: getPngDataUrl(),
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('file too large is rejected', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const largeData = 'A'.repeat(512 * 1024 + 10000);
		const largeBase64 = Buffer.from(largeData).toString('base64');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'largesticker',
				image: getPngDataUrl(largeBase64),
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('invalid file format is rejected with unsupported mime type', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'invalidformat',
				image: 'data:image/bmp;base64,Qk1CAAAAAAAAAD4AAAAoAAAAAQAAAAEAAAABAAEAAAAAAA==',
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('invalid base64 encoding is rejected', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'invalidbase64',
				image: 'data:image/png;base64,not-valid-base64!!!',
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('missing image field is rejected', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'noimage',
				description: 'Missing image',
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('missing name field is rejected', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		await createBuilder(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				description: 'Missing name',
				image: getPngDataUrl(),
			})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
	});

	it('sticker with empty tags array succeeds', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const sticker = await createBuilder<StickerResponse>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'notags',
				tags: [],
				image: getPngDataUrl(),
			})
			.expect(200)
			.execute();

		expect(sticker.id).toBeDefined();
		expect(sticker.tags).toEqual([]);
	});

	it('sticker with maximum allowed name length succeeds', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const sticker = await createBuilder<StickerResponse>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'a'.repeat(30),
				image: getPngDataUrl(),
			})
			.expect(200)
			.execute();

		expect(sticker.id).toBeDefined();
		expect(sticker.name).toBe('a'.repeat(30));
	});

	it('sticker with maximum allowed tags succeeds', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const tags = Array.from({length: 10}, (_, i) => `tag${i}`);

		const sticker = await createBuilder<StickerResponse>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'maxtags',
				tags,
				image: getPngDataUrl(),
			})
			.expect(200)
			.execute();

		expect(sticker.id).toBeDefined();
		expect(sticker.tags).toEqual(tags);
	});

	it('sticker with maximum allowed description length succeeds', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const sticker = await createBuilder<StickerResponse>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'maxdesc',
				description: 'a'.repeat(500),
				image: getPngDataUrl(),
			})
			.expect(200)
			.execute();

		expect(sticker.id).toBeDefined();
		expect(sticker.description).toBe('a'.repeat(500));
	});

	it('sticker name with spaces is allowed', async () => {
		const user = await createTestAccount(harness);
		const guild = await createTestGuild(harness, user.token, 'Sticker Test Guild');

		const sticker = await createBuilder<StickerResponse>(harness, user.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'test sticker name',
				image: getPngDataUrl(),
			})
			.expect(200)
			.execute();

		expect(sticker.id).toBeDefined();
		expect(sticker.name).toBe('test sticker name');
	});
});
