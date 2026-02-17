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

import type {FavoriteMemeRecord} from '@app/records/FavoriteMemeRecord';
import type {EmbedMedia, MessageEmbed} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

function extractKlipyName(url: string): string | null {
	try {
		const klipyRegex = /klipy\.com\/clips\/([a-z0-9-]+)-(?:gif|gifv?)-\d+/i;
		const match = url.match(klipyRegex);
		if (match?.[1]) {
			return match[1].split('-').join(' ');
		}
	} catch {}
	return null;
}

function extractFilenameFromUrl(url: string): string | null {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const filename = pathname.split('/').pop();
		if (!filename) return null;

		const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

		const cleaned = nameWithoutExt.replace(/[-_]/g, ' ').trim();

		return cleaned || null;
	} catch {
		return null;
	}
}

export function deriveDefaultNameFromAttachment(i18n: I18n, attachment: MessageAttachment): string {
	if (attachment.title?.trim()) {
		return attachment.title.trim();
	}

	if (attachment.filename) {
		const nameWithoutExt = attachment.filename.replace(/\.[^.]+$/, '');
		const cleaned = nameWithoutExt.replace(/[-_]/g, ' ').trim();
		if (cleaned) return cleaned;
	}

	if (attachment.url) {
		const urlName = extractFilenameFromUrl(attachment.url);
		if (urlName) return urlName;
	}

	if (attachment.content_type) {
		if (attachment.content_type.startsWith('image/gif')) return i18n._(msg`GIF`);
		if (attachment.content_type.startsWith('image/')) return i18n._(msg`Image`);
		if (attachment.content_type.startsWith('video/')) return i18n._(msg`Video`);
		if (attachment.content_type.startsWith('audio/')) return i18n._(msg`Audio`);
	}

	return i18n._(msg`Media`);
}

export function deriveDefaultNameFromEmbedMedia(i18n: I18n, embedMedia: EmbedMedia, embed?: MessageEmbed): string {
	if (embed?.title?.trim()) {
		return embed.title.trim();
	}

	if (embedMedia.description?.trim()) {
		return embedMedia.description.trim();
	}

	if (embedMedia.url) {
		const klipyName = extractKlipyName(embedMedia.url);
		if (klipyName) return klipyName;

		const urlName = extractFilenameFromUrl(embedMedia.url);
		if (urlName) return urlName;
	}

	if (embedMedia.content_type) {
		if (embedMedia.content_type.startsWith('image/gif')) return i18n._(msg`GIF`);
		if (embedMedia.content_type.startsWith('image/')) return i18n._(msg`Image`);
		if (embedMedia.content_type.startsWith('video/')) return i18n._(msg`Video`);
		if (embedMedia.content_type.startsWith('audio/')) return i18n._(msg`Audio`);
	}

	return i18n._(msg`Media`);
}

export function isFavoritedByContentHash(
	memes: ReadonlyArray<FavoriteMemeRecord>,
	contentHash: string | null | undefined,
): boolean {
	if (!contentHash) return false;
	return memes.some((meme) => meme.contentHash === contentHash);
}

export function isFavoritedByKlipySlug(
	memes: ReadonlyArray<FavoriteMemeRecord>,
	klipySlug: string | null | undefined,
): boolean {
	if (!klipySlug) return false;
	return memes.some((meme) => meme.klipySlug === klipySlug);
}

export function isFavoritedByTenorSlugId(
	memes: ReadonlyArray<FavoriteMemeRecord>,
	tenorSlugId: string | null | undefined,
): boolean {
	if (!tenorSlugId) return false;
	return memes.some((meme) => meme.tenorSlugId === tenorSlugId);
}

export function isFavorited(
	memes: ReadonlyArray<FavoriteMemeRecord>,
	params: {contentHash?: string | null; klipySlug?: string | null; tenorSlugId?: string | null},
): boolean {
	if (params.klipySlug) {
		return isFavoritedByKlipySlug(memes, params.klipySlug);
	}
	if (params.tenorSlugId) {
		return isFavoritedByTenorSlugId(memes, params.tenorSlugId);
	}
	if (params.contentHash) {
		return isFavoritedByContentHash(memes, params.contentHash);
	}
	return false;
}

export function findFavoritedMeme(
	memes: ReadonlyArray<FavoriteMemeRecord>,
	params: {contentHash?: string | null; klipySlug?: string | null; tenorSlugId?: string | null},
): FavoriteMemeRecord | null {
	if (params.klipySlug) {
		return memes.find((meme) => meme.klipySlug === params.klipySlug) ?? null;
	}
	if (params.tenorSlugId) {
		return memes.find((meme) => meme.tenorSlugId === params.tenorSlugId) ?? null;
	}
	if (params.contentHash) {
		return memes.find((meme) => meme.contentHash === params.contentHash) ?? null;
	}
	return null;
}
