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

import type {UserPartial} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

export interface GuildEmojiShape {
	id: string;
	guildId: string;
	name: string;
	uniqueName: string;
	allNamesString: string;
	url: string;
	animated: boolean;
	user?: UserPartial;
}

export interface UnicodeEmoji {
	id?: string;
	uniqueName: string;
	name: string;
	names: ReadonlyArray<string>;
	allNamesString: string;
	url?: string;
	surrogates: string;
	hasDiversity: boolean;
	managed: boolean;
	useSpriteSheet: boolean;
	index?: number;
	diversityIndex?: number;
	guildId?: string;
}

export type FlatEmoji = Readonly<
	Partial<GuildEmojiShape> &
		Partial<UnicodeEmoji> & {
			name: string;
			allNamesString: string;
			uniqueName: string;
			useSpriteSheet?: boolean;
			index?: number;
			diversityIndex?: number;
			hasDiversity?: boolean;
		}
>;
