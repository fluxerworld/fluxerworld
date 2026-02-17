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

import type {
	GuildEmoji,
	GuildEmojiWithUser,
	GuildSticker,
	GuildStickerWithUser,
} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import {sortBySnowflakeDesc} from '@fluxer/snowflake/src/SnowflakeUtils';

type EmojiUpdateListener = (emojis: ReadonlyArray<GuildEmojiWithUser>) => void;
type StickerUpdateListener = (stickers: ReadonlyArray<GuildStickerWithUser>) => void;

const emojiCache = new Map<string, ReadonlyArray<GuildEmojiWithUser>>();
const stickerCache = new Map<string, ReadonlyArray<GuildStickerWithUser>>();

const emojiListeners = new Map<string, Set<EmojiUpdateListener>>();
const stickerListeners = new Map<string, Set<StickerUpdateListener>>();

function freezeList<T>(items: ReadonlyArray<T>): ReadonlyArray<T> {
	return Object.freeze([...items]);
}

function notifyListeners<T>(
	listeners: Map<string, Set<(items: ReadonlyArray<T>) => void>>,
	guildId: string,
	value: ReadonlyArray<T>,
) {
	const listenersForGuild = listeners.get(guildId);
	if (!listenersForGuild) return;
	for (const listener of listenersForGuild) {
		listener(value);
	}
}

function setCache<T extends {id: string}>(
	cache: Map<string, ReadonlyArray<T>>,
	listeners: Map<string, Set<(items: ReadonlyArray<T>) => void>>,
	guildId: string,
	value: ReadonlyArray<T>,
	shouldNotify: boolean,
) {
	const frozen = freezeList(sortBySnowflakeDesc(value));
	cache.set(guildId, frozen);
	if (shouldNotify) {
		notifyListeners(listeners, guildId, frozen);
	}
}

export function seedGuildEmojiCache(guildId: string, emojis: ReadonlyArray<GuildEmojiWithUser>): void {
	setCache(emojiCache, emojiListeners, guildId, emojis, false);
}

export function seedGuildStickerCache(guildId: string, stickers: ReadonlyArray<GuildStickerWithUser>): void {
	setCache(stickerCache, stickerListeners, guildId, stickers, false);
}

export function subscribeToGuildEmojiUpdates(guildId: string, listener: EmojiUpdateListener): () => void {
	let listenersForGuild = emojiListeners.get(guildId);
	if (!listenersForGuild) {
		listenersForGuild = new Set();
		emojiListeners.set(guildId, listenersForGuild);
	}
	listenersForGuild.add(listener);
	return () => {
		listenersForGuild?.delete(listener);
		if (listenersForGuild && listenersForGuild.size === 0) {
			emojiListeners.delete(guildId);
		}
	};
}

export function subscribeToGuildStickerUpdates(guildId: string, listener: StickerUpdateListener): () => void {
	let listenersForGuild = stickerListeners.get(guildId);
	if (!listenersForGuild) {
		listenersForGuild = new Set();
		stickerListeners.set(guildId, listenersForGuild);
	}
	listenersForGuild.add(listener);
	return () => {
		listenersForGuild?.delete(listener);
		if (listenersForGuild && listenersForGuild.size === 0) {
			stickerListeners.delete(guildId);
		}
	};
}

export function patchGuildEmojiCacheFromGateway(guildId: string, updates: ReadonlyArray<GuildEmoji>) {
	const previous = emojiCache.get(guildId) ?? [];
	const previousUserById = new Map(previous.map((emoji) => [emoji.id, emoji.user]));

	const next = updates
		.map((emoji) => {
			const user = emoji.user ?? previousUserById.get(emoji.id);
			if (!user) {
				return null;
			}
			return {
				...emoji,
				user,
			};
		})
		.filter((entry): entry is GuildEmojiWithUser => Boolean(entry));

	setCache(emojiCache, emojiListeners, guildId, next, true);
}

export function patchGuildStickerCacheFromGateway(guildId: string, updates: ReadonlyArray<GuildSticker>) {
	const previous = stickerCache.get(guildId) ?? [];
	const previousUserById = new Map(previous.map((sticker) => [sticker.id, sticker.user]));

	const next = updates
		.map((sticker) => {
			const user = sticker.user ?? previousUserById.get(sticker.id);
			if (!user) {
				return null;
			}
			return {
				...sticker,
				user,
			};
		})
		.filter((entry): entry is GuildStickerWithUser => Boolean(entry));

	setCache(stickerCache, stickerListeners, guildId, next, true);
}
