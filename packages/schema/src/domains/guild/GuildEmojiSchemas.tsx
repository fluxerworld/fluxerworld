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

import {type UserPartial, UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const GuildEmojiResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this emoji'),
	name: z.string().describe('The name of the emoji'),
	animated: z.boolean().describe('Whether this emoji is animated'),
});

export type GuildEmojiResponse = z.infer<typeof GuildEmojiResponse>;

export const GuildEmojiWithUserResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this emoji'),
	name: z.string().describe('The name of the emoji'),
	animated: z.boolean().describe('Whether this emoji is animated'),
	user: z.lazy(() => UserPartialResponse).describe('The user who uploaded this emoji'),
});

export type GuildEmojiWithUserResponse = z.infer<typeof GuildEmojiWithUserResponse>;

export const GuildStickerResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this sticker'),
	name: z.string().describe('The name of the sticker'),
	description: z.string().describe('The description of the sticker'),
	tags: z.array(z.string()).max(100).describe('Autocomplete/suggestion tags for the sticker'),
	animated: z.boolean().describe('Whether this sticker is animated'),
});

export type GuildStickerResponse = z.infer<typeof GuildStickerResponse>;

export const GuildStickerWithUserResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this sticker'),
	name: z.string().describe('The name of the sticker'),
	description: z.string().describe('The description of the sticker'),
	tags: z.array(z.string()).max(100).describe('Autocomplete/suggestion tags for the sticker'),
	animated: z.boolean().describe('Whether this sticker is animated'),
	user: z.lazy(() => UserPartialResponse).describe('The user who uploaded this sticker'),
});

export type GuildStickerWithUserResponse = z.infer<typeof GuildStickerWithUserResponse>;

export const GuildEmojiBulkCreateResponse = z.object({
	success: z.array(GuildEmojiResponse).max(500).describe('Successfully created emojis'),
	failed: z
		.array(
			z.object({
				name: z.string().describe('The name of the emoji that failed to create'),
				error: z.string().describe('The error message explaining why the emoji failed to create'),
			}),
		)
		.max(500)
		.describe('Emojis that failed to create'),
});

export type GuildEmojiBulkCreateResponse = z.infer<typeof GuildEmojiBulkCreateResponse>;

export const GuildStickerBulkCreateResponse = z.object({
	success: z.array(GuildStickerResponse).max(500).describe('Successfully created stickers'),
	failed: z
		.array(
			z.object({
				name: z.string().describe('The name of the sticker that failed to create'),
				error: z.string().describe('The error message explaining why the sticker failed to create'),
			}),
		)
		.max(500)
		.describe('Stickers that failed to create'),
});

export type GuildStickerBulkCreateResponse = z.infer<typeof GuildStickerBulkCreateResponse>;

export const GuildEmojiWithUserListResponse = z.array(GuildEmojiWithUserResponse);

export type GuildEmojiWithUserListResponse = z.infer<typeof GuildEmojiWithUserListResponse>;

export const GuildStickerWithUserListResponse = z.array(GuildStickerWithUserResponse);

export type GuildStickerWithUserListResponse = z.infer<typeof GuildStickerWithUserListResponse>;

export interface GuildEmoji {
	readonly id: string;
	readonly name: string;
	readonly animated: boolean;
	readonly user?: UserPartial;
}

export interface GuildEmojiWithUser extends GuildEmoji {
	readonly user: UserPartial;
}

export interface GuildSticker {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly tags: Array<string>;
	readonly animated: boolean;
	readonly user?: UserPartial;
}

export interface GuildStickerWithUser extends GuildSticker {
	readonly user: UserPartial;
}
