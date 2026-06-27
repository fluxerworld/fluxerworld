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

import type {MessagePlaintextEntry} from '@app/lib/e2ee/E2EEKeyStore';
import type {MessageSearchParams} from '@app/utils/SearchUtils';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

const URL_REGEX = /https?:\/\/[^\s]+/i;
const GLOBAL_URL_REGEX = /https?:\/\/[^\s]+/gi;

export interface SearchableEncryptedMessageEntry extends MessagePlaintextEntry {
	channel_id: string;
	message: Message;
}

export function isSearchableEncryptedMessageEntry(
	entry: MessagePlaintextEntry,
): entry is SearchableEncryptedMessageEntry {
	return typeof entry.channel_id === 'string' && entry.message != null;
}

const normalize = (value: string): string => value.toLocaleLowerCase();

const containsWords = (haystack: string, query: string): boolean => {
	const words = normalize(query).split(/\s+/).filter(Boolean);
	return words.every((word) => haystack.includes(word));
};

const matchesText = (plaintext: string, params: MessageSearchParams): boolean => {
	const normalized = normalize(plaintext);
	if (params.content && !containsWords(normalized, params.content)) {
		return false;
	}
	if (params.contents?.length && !params.contents.some((query) => containsWords(normalized, query))) {
		return false;
	}
	if (params.exactPhrases?.some((phrase) => !normalized.includes(normalize(phrase)))) {
		return false;
	}
	return true;
};

const getAuthorType = (message: Message): 'user' | 'bot' | 'webhook' => {
	if (message.webhook_id) return 'webhook';
	if (message.author.bot) return 'bot';
	return 'user';
};

const getAttachmentKinds = (message: Message): Set<string> => {
	const kinds = new Set<string>();
	const attachments = message.attachments ?? [];
	if (attachments.length > 0) kinds.add('file');
	for (const attachment of attachments) {
		const contentType = attachment.content_type?.toLocaleLowerCase() ?? '';
		if (contentType.startsWith('image/')) kinds.add('image');
		if (contentType.startsWith('audio/')) kinds.add('sound');
		if (contentType.startsWith('video/')) kinds.add('video');
	}
	if ((message.stickers ?? []).length > 0) kinds.add('sticker');
	if ((message.embeds ?? []).length > 0) kinds.add('embed');
	if (URL_REGEX.test(message.content)) kinds.add('link');
	if (message.message_snapshots?.length) kinds.add('snapshot');
	if ('poll' in message && message.poll) kinds.add('poll');
	return kinds;
};

const getLinkHostnames = (message: Message): Set<string> => {
	const hostnames = new Set<string>();
	for (const match of message.content.matchAll(GLOBAL_URL_REGEX)) {
		try {
			hostnames.add(new URL(match[0]).hostname.toLocaleLowerCase());
		} catch {}
	}
	for (const embed of message.embeds ?? []) {
		if (!embed.url) continue;
		try {
			hostnames.add(new URL(embed.url).hostname.toLocaleLowerCase());
		} catch {}
	}
	return hostnames;
};

const matchesMetadata = (entry: SearchableEncryptedMessageEntry, params: MessageSearchParams): boolean => {
	const {message, channel_id: channelId, message_id: messageId} = entry;

	if (params.channelId?.length && !params.channelId.includes(channelId)) return false;
	if (params.excludeChannelId?.includes(channelId)) return false;

	const numericMessageId = BigInt(messageId);
	if (params.maxId && numericMessageId > BigInt(params.maxId)) return false;
	if (params.minId && numericMessageId < BigInt(params.minId)) return false;

	if (params.authorId?.length && !params.authorId.includes(message.author.id)) return false;
	if (params.excludeAuthorId?.includes(message.author.id)) return false;

	const authorType = getAuthorType(message);
	if (params.authorType?.length && !params.authorType.includes(authorType)) return false;
	if (params.excludeAuthorType?.includes(authorType)) return false;

	const mentionedUserIds = new Set((message.mentions ?? []).map((user) => user.id));
	if (params.mentions?.some((userId) => !mentionedUserIds.has(userId))) return false;
	if (params.excludeMentions?.some((userId) => mentionedUserIds.has(userId))) return false;
	if (params.mentionEveryone !== undefined && message.mention_everyone !== params.mentionEveryone) return false;
	if (params.pinned !== undefined && message.pinned !== params.pinned) return false;

	const attachmentKinds = getAttachmentKinds(message);
	if (params.has?.some((kind) => !attachmentKinds.has(kind))) return false;
	if (params.excludeHas?.some((kind) => attachmentKinds.has(kind))) return false;

	const embeds = message.embeds ?? [];
	const embedTypes = new Set(embeds.flatMap((embed) => (embed.type ? [embed.type] : [])));
	if (params.embedType?.some((type) => !embedTypes.has(type))) return false;
	if (params.excludeEmbedType?.some((type) => embedTypes.has(type))) return false;

	const embedProviders = new Set(
		embeds.flatMap((embed) => (embed.provider?.name ? [normalize(embed.provider.name)] : [])),
	);
	if (params.embedProvider?.some((provider) => !embedProviders.has(normalize(provider)))) return false;
	if (params.excludeEmbedProvider?.some((provider) => embedProviders.has(normalize(provider)))) return false;

	const linkHostnames = getLinkHostnames(message);
	if (params.linkHostname?.some((hostname) => !linkHostnames.has(normalize(hostname)))) return false;
	if (params.excludeLinkHostname?.some((hostname) => linkHostnames.has(normalize(hostname)))) return false;

	const filenames = (message.attachments ?? []).map((attachment) => normalize(attachment.filename));
	if (params.attachmentFilename?.some((filename) => !filenames.some((value) => value.includes(normalize(filename)))))
		return false;
	if (
		params.excludeAttachmentFilename?.some((filename) => filenames.some((value) => value.includes(normalize(filename))))
	)
		return false;

	const extensions = filenames
		.map((filename) => filename.split('.').at(-1))
		.filter((extension): extension is string => Boolean(extension));
	if (params.attachmentExtension?.some((extension) => !extensions.includes(normalize(extension)))) return false;
	if (params.excludeAttachmentExtension?.some((extension) => extensions.includes(normalize(extension)))) return false;

	return true;
};

const relevanceScore = (plaintext: string, params: MessageSearchParams): number => {
	const normalized = normalize(plaintext);
	const needles = [...(params.content?.split(/\s+/) ?? []), ...(params.contents ?? []), ...(params.exactPhrases ?? [])]
		.map(normalize)
		.filter(Boolean);

	let score = 0;
	for (const needle of needles) {
		let offset = 0;
		while (offset < normalized.length) {
			const index = normalized.indexOf(needle, offset);
			if (index === -1) break;
			score += 1;
			offset = index + Math.max(needle.length, 1);
		}
	}
	return score;
};

export function filterAndSortEncryptedMessages(
	entries: ReadonlyArray<MessagePlaintextEntry>,
	params: MessageSearchParams,
): Array<SearchableEncryptedMessageEntry> {
	const matches = entries
		.filter(isSearchableEncryptedMessageEntry)
		.filter((entry) => matchesText(entry.plaintext, params) && matchesMetadata(entry, params));

	const direction = params.sortOrder === 'asc' ? 1 : -1;
	if (params.sortBy === 'relevance') {
		matches.sort((left, right) => {
			const scoreDifference = relevanceScore(right.plaintext, params) - relevanceScore(left.plaintext, params);
			if (scoreDifference !== 0) return scoreDifference;
			return BigInt(left.message_id) < BigInt(right.message_id) ? 1 : -1;
		});
		return matches;
	}

	matches.sort((left, right) => {
		const leftId = BigInt(left.message_id);
		const rightId = BigInt(right.message_id);
		if (leftId === rightId) return 0;
		return (leftId < rightId ? -1 : 1) * direction;
	});
	return matches;
}
