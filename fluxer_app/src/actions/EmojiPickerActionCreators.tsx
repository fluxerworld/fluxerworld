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

import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';

function getEmojiKey(emoji: FlatEmoji): string {
	if (emoji.id) {
		return `custom:${emoji.guildId}:${emoji.id}`;
	}
	return `unicode:${emoji.uniqueName}`;
}

export function trackEmojiUsage(emoji: FlatEmoji): void {
	EmojiPickerStore.trackEmojiUsage(getEmojiKey(emoji));
}

export function toggleFavorite(emoji: FlatEmoji): void {
	EmojiPickerStore.toggleFavorite(getEmojiKey(emoji));
}

export function toggleCategory(category: string): void {
	EmojiPickerStore.toggleCategory(category);
}
