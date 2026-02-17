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

import {
	createTestAccountForAttachmentTests,
	setupTestGuildAndChannel,
} from '@fluxer/api/src/channel/tests/AttachmentTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {
	createFavoriteMemeFromMessage,
	createMessageWithImageAttachment,
	deleteFavoriteMeme,
	getFavoriteMeme,
	listFavoriteMemes,
	updateFavoriteMeme,
} from '@fluxer/api/src/user/tests/FavoriteMemeTestUtils';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Favorite Meme Operations', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should create favorite meme from message attachment', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		const meme = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'My Favorite Meme',
		});

		expect(meme.id).toBeTruthy();
		expect(meme.name).toBe('My Favorite Meme');
		expect(meme.user_id).toBe(account.userId);
		expect(meme.filename).toBe('yeah.png');
		expect(meme.content_type).toBe('image/png');
	});

	test('should create favorite meme with alt text and tags', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		const meme = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Tagged Meme',
			alt_text: 'A funny image',
			tags: ['funny', 'reaction'],
		});

		expect(meme.name).toBe('Tagged Meme');
		expect(meme.alt_text).toBe('A funny image');
		expect(meme.tags).toEqual(['funny', 'reaction']);
	});

	test('should list favorite memes', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message1 = await createMessageWithImageAttachment(harness, account.token, channel.id);
		await createFavoriteMemeFromMessage(harness, account.token, channel.id, message1.id, {
			attachment_id: message1.attachments[0].id,
			name: 'First Meme',
		});

		const message2 = await createMessageWithImageAttachment(harness, account.token, channel.id, 'thisisfine.gif');
		await createFavoriteMemeFromMessage(harness, account.token, channel.id, message2.id, {
			attachment_id: message2.attachments[0].id,
			name: 'Second Meme',
		});

		const memes = await listFavoriteMemes(harness, account.token);

		expect(memes.length).toBe(2);
		expect(memes.some((m) => m.name === 'First Meme')).toBe(true);
		expect(memes.some((m) => m.name === 'Second Meme')).toBe(true);
	});

	test('should get single favorite meme by id', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		const created = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Get Me',
		});

		const meme = await getFavoriteMeme(harness, account.token, created.id);

		expect(meme.id).toBe(created.id);
		expect(meme.name).toBe('Get Me');
	});

	test('should update favorite meme name', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		const created = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Original Name',
		});

		const updated = await updateFavoriteMeme(harness, account.token, created.id, {
			name: 'New Name',
		});

		expect(updated.name).toBe('New Name');
	});

	test('should update favorite meme alt text', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		const created = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Meme Name',
		});

		const updated = await updateFavoriteMeme(harness, account.token, created.id, {
			alt_text: 'Updated description',
		});

		expect(updated.alt_text).toBe('Updated description');
	});

	test('should clear favorite meme alt text by setting to null', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		const created = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Meme',
			alt_text: 'Has alt text',
		});

		expect(created.alt_text).toBe('Has alt text');

		const updated = await updateFavoriteMeme(harness, account.token, created.id, {
			alt_text: null,
		});

		expect(updated.alt_text).toBeNull();
	});

	test('should update favorite meme tags', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		const created = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Tagged',
			tags: ['old-tag'],
		});

		const updated = await updateFavoriteMeme(harness, account.token, created.id, {
			tags: ['new-tag', 'another-tag'],
		});

		expect(updated.tags).toEqual(['new-tag', 'another-tag']);
	});

	test('should delete favorite meme', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		const created = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Delete Me',
		});

		await deleteFavoriteMeme(harness, account.token, created.id);

		const memes = await listFavoriteMemes(harness, account.token);
		expect(memes.find((m) => m.id === created.id)).toBeUndefined();
	});

	test('should return 404 for unknown meme id', async () => {
		const account = await createTestAccountForAttachmentTests(harness);

		await createBuilder(harness, account.token)
			.get('/users/@me/memes/999999999999999999')
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('should require name when creating from message', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: message.attachments[0].id,
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should require either attachment_id or embed_index', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				name: 'Test Meme',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should validate name length max 100 characters', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: message.attachments[0].id,
				name: 'a'.repeat(101),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should validate alt_text length max 500 characters', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: message.attachments[0].id,
				name: 'Valid Name',
				alt_text: 'a'.repeat(501),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should validate tag length max 30 characters', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: message.attachments[0].id,
				name: 'Valid Name',
				tags: ['a'.repeat(31)],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should reject empty tags', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: message.attachments[0].id,
				name: 'Tagged Meme',
				tags: ['valid', '', '  ', 'another'],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should delete idempotently', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		const created = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Delete Twice',
		});

		await deleteFavoriteMeme(harness, account.token, created.id);

		await createBuilder(harness, account.token)
			.delete(`/users/@me/memes/${created.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
	});

	test('should return empty list when no memes exist', async () => {
		const account = await createTestAccountForAttachmentTests(harness);

		const memes = await listFavoriteMemes(harness, account.token);

		expect(memes).toEqual([]);
	});

	test('should include url in meme response', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		const meme = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'URL Test',
		});

		expect(meme.url).toBeTruthy();
		expect(meme.url).toContain(meme.attachment_id);
		expect(meme.url).toContain(meme.filename);
	});
});
