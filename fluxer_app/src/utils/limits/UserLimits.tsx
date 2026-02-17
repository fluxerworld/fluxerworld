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

import type {UserRecord} from '@app/records/UserRecord';
import UserStore from '@app/stores/UserStore';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {MAX_BIO_LENGTH} from '@fluxer/constants/src/LimitConstants';

const FALLBACKS = {
	max_guilds_free: 100,
	max_message_length_free: 2000,
	max_attachments_per_message: 10,

	max_bio_length: MAX_BIO_LENGTH,

	max_bookmarks_free: 50,
	max_favorite_memes_free: 50,
	max_favorite_meme_tags: 10,

	max_relationships: 1000,
	max_group_dm_recipients: 25,
	max_private_channels_per_user: 250,

	max_attachment_file_size_free: 25 * 1024 * 1024,
} as const;

class LimitsClass {
	private getCurrentUser(): UserRecord | undefined {
		return UserStore.getCurrentUser();
	}

	getMaxGuilds(): number {
		const user = this.getCurrentUser();
		if (user?.maxGuilds) return user.maxGuilds;
		return LimitResolver.resolve({key: 'max_guilds', fallback: FALLBACKS.max_guilds_free});
	}

	getMaxMessageLength(): number {
		const user = this.getCurrentUser();
		if (user?.maxMessageLength) return user.maxMessageLength;
		return LimitResolver.resolve({key: 'max_message_length', fallback: FALLBACKS.max_message_length_free});
	}

	getMaxAttachmentsPerMessage(): number {
		const user = this.getCurrentUser();
		if (user?.maxAttachmentsPerMessage) return user.maxAttachmentsPerMessage;
		return LimitResolver.resolve({key: 'max_attachments_per_message', fallback: FALLBACKS.max_attachments_per_message});
	}

	getMaxAttachmentFileSize(): number {
		const user = this.getCurrentUser();
		if (user?.maxAttachmentFileSize) return user.maxAttachmentFileSize;
		return LimitResolver.resolve({key: 'max_attachment_file_size', fallback: FALLBACKS.max_attachment_file_size_free});
	}

	getMaxBioLength(): number {
		const user = this.getCurrentUser();
		if (user?.maxBioLength) return user.maxBioLength;
		return LimitResolver.resolve({key: 'max_bio_length', fallback: FALLBACKS.max_bio_length});
	}

	getMaxBookmarks(): number {
		const user = this.getCurrentUser();
		if (user?.maxBookmarks) return user.maxBookmarks;
		return LimitResolver.resolve({key: 'max_bookmarks', fallback: FALLBACKS.max_bookmarks_free});
	}

	getMaxFavoriteMemes(): number {
		const user = this.getCurrentUser();
		if (user?.maxFavoriteMemes) return user.maxFavoriteMemes;
		return LimitResolver.resolve({key: 'max_favorite_memes', fallback: FALLBACKS.max_favorite_memes_free});
	}

	getMaxFavoriteMemeTags(): number {
		const user = this.getCurrentUser();
		if (user?.maxFavoriteMemeTags) return user.maxFavoriteMemeTags;
		return LimitResolver.resolve({key: 'max_favorite_meme_tags', fallback: FALLBACKS.max_favorite_meme_tags});
	}

	getMaxRelationships(): number {
		const user = this.getCurrentUser();
		if (user?.maxRelationships) return user.maxRelationships;
		return LimitResolver.resolve({key: 'max_relationships', fallback: FALLBACKS.max_relationships});
	}

	getMaxGroupDmRecipients(): number {
		const user = this.getCurrentUser();
		if (user?.maxGroupDmRecipients) return user.maxGroupDmRecipients;
		return LimitResolver.resolve({key: 'max_group_dm_recipients', fallback: FALLBACKS.max_group_dm_recipients});
	}

	getMaxPrivateChannels(): number {
		const user = this.getCurrentUser();
		if (user?.maxPrivateChannels) return user.maxPrivateChannels;
		return LimitResolver.resolve({
			key: 'max_private_channels_per_user',
			fallback: FALLBACKS.max_private_channels_per_user,
		});
	}

	getPremiumValue(key: LimitKey, fallback: number): number {
		return LimitResolver.resolvePremium(key, fallback);
	}

	getFreeValue(key: LimitKey, fallback: number): number {
		return LimitResolver.resolveFree(key, fallback);
	}

	getMultiple(keys: Array<LimitKey>, fallbacks: Partial<Record<LimitKey, number>> = {}): Record<string, number> {
		const result: Record<string, number> = {};

		for (const key of keys) {
			const fallback = (fallbacks as Record<string, number>)[key];
			const defaultFallback = this._getDefaultFallback(key);
			result[key] = LimitResolver.resolve({
				key,
				fallback: fallback ?? defaultFallback,
			});
		}

		return result;
	}

	private _getDefaultFallback(key: LimitKey): number {
		const fallbackMap: Record<string, () => number> = {
			max_guilds: () => FALLBACKS.max_guilds_free,
			max_message_length: () => FALLBACKS.max_message_length_free,
			max_attachments_per_message: () => FALLBACKS.max_attachments_per_message,
			max_bio_length: () => FALLBACKS.max_bio_length,
			max_bookmarks: () => FALLBACKS.max_bookmarks_free,
			max_favorite_memes: () => FALLBACKS.max_favorite_memes_free,
			max_favorite_meme_tags: () => FALLBACKS.max_favorite_meme_tags,
			max_relationships: () => FALLBACKS.max_relationships,
			max_group_dm_recipients: () => FALLBACKS.max_group_dm_recipients,
			max_private_channels_per_user: () => FALLBACKS.max_private_channels_per_user,
			max_attachment_file_size: () => FALLBACKS.max_attachment_file_size_free,
		};

		const getter = fallbackMap[key];
		return getter ? getter() : 0;
	}
}

export const Limits = new LimitsClass();
