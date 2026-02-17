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
	listFavoriteMemes,
} from '@fluxer/api/src/user/tests/FavoriteMemeTestUtils';
import {MAX_FAVORITE_MEME_TAGS, MAX_FAVORITE_MEMES_NON_PREMIUM} from '@fluxer/constants/src/LimitConstants';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Favorite Meme Limits', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should enforce maximum favorite memes limit for non-premium users', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		for (let i = 0; i < MAX_FAVORITE_MEMES_NON_PREMIUM; i++) {
			const message = await createMessageWithImageAttachment(
				harness,
				account.token,
				channel.id,
				i % 2 === 0 ? 'yeah.png' : 'thisisfine.gif',
			);
			await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
				attachment_id: message.attachments[0].id,
				name: `Meme ${i + 1}`,
			});
		}

		const memes = await listFavoriteMemes(harness, account.token);
		expect(memes.length).toBe(MAX_FAVORITE_MEMES_NON_PREMIUM);

		const extraMessage = await createMessageWithImageAttachment(harness, account.token, channel.id);
		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${extraMessage.id}/memes`)
			.body({
				attachment_id: extraMessage.attachments[0].id,
				name: 'One Too Many',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	}, 10000);

	test('should enforce maximum tags per meme limit', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		const tooManyTags = Array.from({length: MAX_FAVORITE_MEME_TAGS + 1}, (_, i) => `tag${i + 1}`);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: message.attachments[0].id,
				name: 'Too Many Tags',
				tags: tooManyTags,
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should allow exactly max tags per meme', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		const maxTags = Array.from({length: MAX_FAVORITE_MEME_TAGS}, (_, i) => `tag${i + 1}`);

		const meme = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Max Tags Meme',
			tags: maxTags,
		});

		expect(meme.tags.length).toBe(MAX_FAVORITE_MEME_TAGS);
	});

	test('should enforce tag limit on update', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		const meme = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Initial Tags',
			tags: ['tag1', 'tag2'],
		});

		const tooManyTags = Array.from({length: MAX_FAVORITE_MEME_TAGS + 1}, (_, i) => `newtag${i + 1}`);

		await createBuilder(harness, account.token)
			.patch(`/users/@me/memes/${meme.id}`)
			.body({
				tags: tooManyTags,
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should reject saving same attachment twice', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);
		await createFavoriteMemeFromMessage(harness, account.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Original',
		});

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: message.attachments[0].id,
				name: 'Duplicate',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should allow different media content', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message1 = await createMessageWithImageAttachment(harness, account.token, channel.id, 'yeah.png');
		await createFavoriteMemeFromMessage(harness, account.token, channel.id, message1.id, {
			attachment_id: message1.attachments[0].id,
			name: 'PNG Meme',
		});

		const message2 = await createMessageWithImageAttachment(harness, account.token, channel.id, 'thisisfine.gif');
		const meme2 = await createFavoriteMemeFromMessage(harness, account.token, channel.id, message2.id, {
			attachment_id: message2.attachments[0].id,
			name: 'GIF Meme',
		});

		expect(meme2.id).toBeTruthy();
		expect(meme2.filename).toBe('thisisfine.gif');
	});

	test('should return error for invalid attachment id', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: '999999999999999999',
				name: 'Invalid Attachment',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should return error for invalid embed index', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const message = await createMessageWithImageAttachment(harness, account.token, channel.id);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				embed_index: 99,
				name: 'Invalid Embed',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should return error for message without media', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		const {sendMessage} = await import('@fluxer/api/src/message/tests/MessageTestUtils');
		const textMessage = await sendMessage(harness, account.token, channel.id, 'No media here');

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/${textMessage.id}/memes`)
			.body({
				embed_index: 0,
				name: 'No Media',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should return error for unknown message', async () => {
		const account = await createTestAccountForAttachmentTests(harness);
		const {channel} = await setupTestGuildAndChannel(harness, account);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/messages/999999999999999999/memes`)
			.body({
				attachment_id: '123',
				name: 'Unknown Message',
			})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('should return error for inaccessible channel', async () => {
		const account1 = await createTestAccountForAttachmentTests(harness);
		const account2 = await createTestAccountForAttachmentTests(harness);

		const {channel} = await setupTestGuildAndChannel(harness, account1);
		const message = await createMessageWithImageAttachment(harness, account1.token, channel.id);

		await createBuilder(harness, account2.token)
			.post(`/channels/${channel.id}/messages/${message.id}/memes`)
			.body({
				attachment_id: message.attachments[0].id,
				name: 'Inaccessible',
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should not allow accessing other users memes', async () => {
		const account1 = await createTestAccountForAttachmentTests(harness);
		const account2 = await createTestAccountForAttachmentTests(harness);

		const {channel} = await setupTestGuildAndChannel(harness, account1);
		const message = await createMessageWithImageAttachment(harness, account1.token, channel.id);
		const meme = await createFavoriteMemeFromMessage(harness, account1.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Private Meme',
		});

		await createBuilder(harness, account2.token)
			.get(`/users/@me/memes/${meme.id}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('should not allow updating other users memes', async () => {
		const account1 = await createTestAccountForAttachmentTests(harness);
		const account2 = await createTestAccountForAttachmentTests(harness);

		const {channel} = await setupTestGuildAndChannel(harness, account1);
		const message = await createMessageWithImageAttachment(harness, account1.token, channel.id);
		const meme = await createFavoriteMemeFromMessage(harness, account1.token, channel.id, message.id, {
			attachment_id: message.attachments[0].id,
			name: 'Private Meme',
		});

		await createBuilder(harness, account2.token)
			.patch(`/users/@me/memes/${meme.id}`)
			.body({
				name: 'Stolen Meme',
			})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});
});
