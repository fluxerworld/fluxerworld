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

import {createAttachmentID, createChannelID, createMessageID, createUserID} from '@fluxer/api/src/BrandedTypes';
import type {MessageRow} from '@fluxer/api/src/database/types/MessageTypes';
import {Message} from '@fluxer/api/src/models/Message';
import {convertToSearchableMessage} from '@fluxer/api/src/search/message/MessageSearchSerializer';
import {describe, expect, it} from 'vitest';

describe('MessageSearchSerializer', () => {
	it('extracts unique hosts and attachment metadata when indexing a message', () => {
		const row: MessageRow = {
			channel_id: createChannelID(111n),
			bucket: 0,
			message_id: createMessageID(222n),
			author_id: createUserID(333n),
			type: 0,
			webhook_id: null,
			webhook_name: null,
			webhook_avatar_hash: null,
			content: 'Check https://example.com/one and https://example.com/two',
			edited_timestamp: null,
			pinned_timestamp: null,
			flags: 0,
			mention_everyone: false,
			mention_users: new Set([createUserID(444n)]),
			mention_roles: new Set(),
			mention_channels: new Set(),
			attachments: [
				{
					attachment_id: createAttachmentID(555n),
					filename: 'screenshot.png',
					size: 1024n,
					title: null,
					description: null,
					width: null,
					height: null,
					content_type: 'image/png',
					content_hash: null,
					placeholder: null,
					flags: 0,
					duration: null,
					nsfw: null,
					waveform: null,
				},
				{
					attachment_id: createAttachmentID(556n),
					filename: 'screenshot.png',
					size: 2048n,
					title: null,
					description: null,
					width: null,
					height: null,
					content_type: 'image/png',
					content_hash: null,
					placeholder: null,
					flags: 0,
					duration: null,
					nsfw: null,
					waveform: null,
				},
			],
			embeds: [
				{
					type: 'image',
					title: null,
					description: null,
					url: 'https://embed.example.net/image',
					timestamp: null,
					color: null,
					author: null,
					provider: {
						name: 'EmbedCo',
						url: null,
					},
					thumbnail: null,
					image: null,
					video: null,
					footer: null,
					fields: null,
					nsfw: null,
				},
			],
			sticker_items: [],
			message_reference: null,
			message_snapshots: [],
			call: null,
			has_reaction: null,
			version: 1,
		};

		const message = new Message(row);
		const result = convertToSearchableMessage(message, true);

		expect(result.linkHostnames).toEqual(['example.com', 'embed.example.net']);
		expect(result.attachmentFilenames).toEqual(['screenshot.png']);
		expect(result.attachmentExtensions).toEqual(['png']);
		expect(result.embedProviders).toEqual(['EmbedCo']);
		expect(result.hasLink).toBe(true);
		expect(result.hasEmbed).toBe(true);
		expect(result.authorType).toBe('bot');
		expect(result.mentionedUserIds).toEqual([createUserID(444n).toString()]);
	});
});
