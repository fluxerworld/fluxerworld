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

import UnicodeEmojis from '@app/lib/UnicodeEmojis';
import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import GuildListStore from '@app/stores/GuildListStore';
import type {FlatEmoji, UnicodeEmoji} from '@app/types/EmojiTypes';
import {useMemo} from 'react';

export function useEmojiCategories(
	allEmojis: ReadonlyArray<FlatEmoji | UnicodeEmoji>,
	_searchResultEmojis: ReadonlyArray<FlatEmoji | UnicodeEmoji>,
) {
	const guilds = GuildListStore.guilds;

	const favoriteEmojis = EmojiPickerStore.getFavoriteEmojis(allEmojis);

	const frequentlyUsedEmojis = EmojiPickerStore.getFrecentEmojis(allEmojis, 42);

	const customEmojisByGuildId = useMemo(() => {
		const guildEmojis = allEmojis.filter((emoji) => emoji.guildId != null);
		const guildEmojisByGuildId = new Map<string, Array<FlatEmoji>>();

		for (const guildEmoji of guildEmojis) {
			if (!guildEmojisByGuildId.has(guildEmoji.guildId!)) {
				guildEmojisByGuildId.set(guildEmoji.guildId!, []);
			}
			guildEmojisByGuildId.get(guildEmoji.guildId!)?.push(guildEmoji);
		}

		const sortedGuildIds = guilds.map((guild) => guild.id);
		const sortedGuildEmojisByGuildId = new Map<string, Array<FlatEmoji>>();
		for (const guildId of sortedGuildIds) {
			if (guildEmojisByGuildId.has(guildId)) {
				sortedGuildEmojisByGuildId.set(guildId, guildEmojisByGuildId.get(guildId)!);
			}
		}

		return sortedGuildEmojisByGuildId;
	}, [allEmojis, guilds]);

	const unicodeEmojisByCategory = useMemo(() => {
		const unicodeEmojis = allEmojis.filter((emoji) => emoji.guildId == null);
		const unicodeEmojisByCategory = new Map<string, Array<FlatEmoji>>();

		for (const emoji of unicodeEmojis) {
			const category = UnicodeEmojis.getCategoryForEmoji(emoji as UnicodeEmoji)!;
			if (!unicodeEmojisByCategory.has(category)) {
				unicodeEmojisByCategory.set(category, []);
			}
			unicodeEmojisByCategory.get(category)?.push(emoji);
		}

		const categories = UnicodeEmojis.getCategories();
		const sortedUnicodeEmojisByCategory = new Map<string, Array<FlatEmoji>>();
		for (const category of categories) {
			if (unicodeEmojisByCategory.has(category)) {
				sortedUnicodeEmojisByCategory.set(
					category,
					unicodeEmojisByCategory.get(category)!.sort((a, b) => a.index! - b.index!),
				);
			}
		}

		return sortedUnicodeEmojisByCategory;
	}, [allEmojis]);

	return {
		favoriteEmojis,
		frequentlyUsedEmojis,
		customEmojisByGuildId,
		unicodeEmojisByCategory,
	};
}
