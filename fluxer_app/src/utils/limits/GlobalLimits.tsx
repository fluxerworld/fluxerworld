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

import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';

const FALLBACKS = {
	emoji_max_size: 384 * 1024,
	sticker_max_size: 512 * 1024,
	avatar_max_size: 10 * 1024 * 1024,
} as const;

class GlobalLimitsClass {
	getEmojiMaxSize(): number {
		return LimitResolver.resolve({
			key: 'emoji_max_size',
			fallback: FALLBACKS.emoji_max_size,
		});
	}

	getStickerMaxSize(): number {
		return LimitResolver.resolve({
			key: 'sticker_max_size',
			fallback: FALLBACKS.sticker_max_size,
		});
	}

	getAvatarMaxSize(): number {
		return LimitResolver.resolve({
			key: 'avatar_max_size',
			fallback: FALLBACKS.avatar_max_size,
		});
	}

	get(key: LimitKey, fallback: number): number {
		return LimitResolver.resolve({key, fallback});
	}
}

export const GlobalLimits = new GlobalLimitsClass();
