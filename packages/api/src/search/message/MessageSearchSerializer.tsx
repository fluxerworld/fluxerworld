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

import type {Message} from '@fluxer/api/src/models/Message';
import type {SearchableMessage} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';

const LINK_HOSTNAME_MATCHER = /https?:\/\/([^\s/]+)/g;
const HAS_LINK_REGEX = /https?:\/\/[^\s/]+/i;

function getAuthorType(message: Message, authorIsBot?: boolean): 'user' | 'bot' | 'webhook' {
	if (message.webhookId) {
		return 'webhook';
	}

	if (authorIsBot) {
		return 'bot';
	}

	return 'user';
}

function extractAttachmentTypes(message: Message): {hasVideo: boolean; hasImage: boolean; hasSound: boolean} {
	const hasType = (prefix: string) =>
		message.attachments.some((att) => att.contentType.trim().toLowerCase().startsWith(prefix));

	return {
		hasVideo: hasType('video/'),
		hasImage: hasType('image/'),
		hasSound: hasType('audio/'),
	};
}

function extractEmbedTypes(message: Message): Array<string> {
	const types: Array<string> = [];
	for (const embed of message.embeds) {
		if (embed.type && !types.includes(embed.type)) {
			types.push(embed.type);
		}
	}
	return types;
}

function extractEmbedProviders(message: Message): Array<string> {
	const providers: Array<string> = [];
	for (const embed of message.embeds) {
		const providerName = embed.provider?.name;
		if (providerName && !providers.includes(providerName)) {
			providers.push(providerName);
		}
	}
	return providers;
}

function extractLinkHostnames(message: Message): Array<string> {
	const hostnames: Array<string> = [];

	if (message.content) {
		const matcher = new RegExp(LINK_HOSTNAME_MATCHER);
		const matches = message.content.matchAll(matcher);
		for (const match of matches) {
			const hostname = match[1];
			if (hostname && !hostnames.includes(hostname)) {
				hostnames.push(hostname);
			}
		}
	}

	for (const embed of message.embeds) {
		if (!embed.url) {
			continue;
		}

		try {
			const url = new URL(embed.url);
			if (!hostnames.includes(url.hostname)) {
				hostnames.push(url.hostname);
			}
		} catch {}
	}

	return hostnames;
}

function extractAttachmentInfo(message: Message): {
	attachmentFilenames: Array<string>;
	attachmentExtensions: Array<string>;
} {
	const filenames: Array<string> = [];
	const extensions: Array<string> = [];

	for (const attachment of message.attachments) {
		if (!filenames.includes(attachment.filename)) {
			filenames.push(attachment.filename);
		}

		const parts = attachment.filename.split('.');
		if (parts.length <= 1) {
			continue;
		}

		const ext = parts[parts.length - 1]!.toLowerCase();
		if (ext.length > 0 && ext.length <= 10 && !extensions.includes(ext)) {
			extensions.push(ext);
		}
	}

	return {attachmentFilenames: filenames, attachmentExtensions: extensions};
}

export function convertToSearchableMessage(message: Message, authorIsBot?: boolean): SearchableMessage {
	const createdAt = Math.floor(snowflakeToDate(BigInt(message.id)).getTime() / 1000);
	const editedAt = message.editedTimestamp ? Math.floor(message.editedTimestamp.getTime() / 1000) : null;

	const authorType = getAuthorType(message, authorIsBot);
	const {hasVideo, hasImage, hasSound} = extractAttachmentTypes(message);
	const hasLink = message.content !== null && HAS_LINK_REGEX.test(message.content);
	const embedTypes = extractEmbedTypes(message);
	const embedProviders = extractEmbedProviders(message);
	const linkHostnames = extractLinkHostnames(message);
	const {attachmentFilenames, attachmentExtensions} = extractAttachmentInfo(message);

	return {
		id: message.id.toString(),
		channelId: message.channelId.toString(),
		guildId: null,
		authorId: message.authorId?.toString() ?? null,
		authorType,
		content: message.content,
		createdAt,
		editedAt,
		isPinned: message.pinnedTimestamp !== null,
		mentionedUserIds: Array.from(message.mentionedUserIds).map((id) => id.toString()),
		mentionEveryone: message.mentionEveryone,
		hasLink,
		hasEmbed: message.embeds.length > 0,
		hasPoll: false,
		hasFile: message.attachments.length > 0,
		hasVideo,
		hasImage,
		hasSound,
		hasSticker: message.stickers.length > 0,
		hasForward: message.reference?.type === 1,
		embedTypes,
		embedProviders,
		linkHostnames,
		attachmentFilenames,
		attachmentExtensions,
	};
}
