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

import type {EmojiID, GuildID, StickerID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import {ContentHelpers} from '@fluxer/api/src/guild/services/content/ContentHelpers';
import {EmojiService} from '@fluxer/api/src/guild/services/content/EmojiService';
import {ExpressionAssetPurger} from '@fluxer/api/src/guild/services/content/ExpressionAssetPurger';
import {StickerService} from '@fluxer/api/src/guild/services/content/StickerService';
import type {AvatarService} from '@fluxer/api/src/infrastructure/AvatarService';
import type {IAssetDeletionQueue} from '@fluxer/api/src/infrastructure/IAssetDeletionQueue';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {User} from '@fluxer/api/src/models/User';
import type {
	GuildEmojiResponse,
	GuildEmojiWithUserResponse,
	GuildStickerResponse,
	GuildStickerWithUserResponse,
} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

export class GuildContentService {
	private readonly contentHelpers: ContentHelpers;
	private readonly emojiService: EmojiService;
	private readonly stickerService: StickerService;

	constructor(
		guildRepository: IGuildRepositoryAggregate,
		userCacheService: UserCacheService,
		gatewayService: IGatewayService,
		avatarService: AvatarService,
		snowflakeService: SnowflakeService,
		guildAuditLogService: GuildAuditLogService,
		assetDeletionQueue: IAssetDeletionQueue,
		limitConfigService: LimitConfigService,
	) {
		this.contentHelpers = new ContentHelpers(gatewayService, guildAuditLogService);
		const expressionAssetPurger = new ExpressionAssetPurger(assetDeletionQueue);
		this.emojiService = new EmojiService(
			guildRepository,
			userCacheService,
			gatewayService,
			avatarService,
			snowflakeService,
			this.contentHelpers,
			expressionAssetPurger,
			limitConfigService,
		);
		this.stickerService = new StickerService(
			guildRepository,
			userCacheService,
			gatewayService,
			avatarService,
			snowflakeService,
			this.contentHelpers,
			expressionAssetPurger,
			limitConfigService,
		);
	}

	async getEmojis(params: {
		userId: UserID;
		guildId: GuildID;
		requestCache: RequestCache;
	}): Promise<Array<GuildEmojiWithUserResponse>> {
		return this.emojiService.getEmojis(params);
	}

	async getEmojiUser(params: {
		userId: UserID;
		guildId: GuildID;
		emojiId: EmojiID;
		requestCache: RequestCache;
	}): Promise<UserPartialResponse> {
		return this.emojiService.getEmojiUser(params);
	}

	async createEmoji(
		params: {user: User; guildId: GuildID; name: string; image: string},
		auditLogReason?: string | null,
	): Promise<GuildEmojiResponse> {
		return this.emojiService.createEmoji(params, auditLogReason);
	}

	async bulkCreateEmojis(
		params: {user: User; guildId: GuildID; emojis: Array<{name: string; image: string}>},
		auditLogReason?: string | null,
	): Promise<{
		success: Array<GuildEmojiResponse>;
		failed: Array<{name: string; error: string}>;
	}> {
		return this.emojiService.bulkCreateEmojis(params, auditLogReason);
	}

	async updateEmoji(
		params: {userId: UserID; guildId: GuildID; emojiId: EmojiID; name: string},
		auditLogReason?: string | null,
	): Promise<GuildEmojiResponse> {
		return this.emojiService.updateEmoji(params, auditLogReason);
	}

	async deleteEmoji(
		params: {userId: UserID; guildId: GuildID; emojiId: EmojiID; purge?: boolean},
		auditLogReason?: string | null,
	): Promise<void> {
		return this.emojiService.deleteEmoji(params, auditLogReason);
	}

	async getStickers(params: {
		userId: UserID;
		guildId: GuildID;
		requestCache: RequestCache;
	}): Promise<Array<GuildStickerWithUserResponse>> {
		return this.stickerService.getStickers(params);
	}

	async getStickerUser(params: {
		userId: UserID;
		guildId: GuildID;
		stickerId: StickerID;
		requestCache: RequestCache;
	}): Promise<UserPartialResponse> {
		return this.stickerService.getStickerUser(params);
	}

	async createSticker(
		params: {
			user: User;
			guildId: GuildID;
			name: string;
			description?: string | null;
			tags: Array<string>;
			image: string;
		},
		auditLogReason?: string | null,
	): Promise<GuildStickerResponse> {
		return this.stickerService.createSticker(params, auditLogReason);
	}

	async bulkCreateStickers(
		params: {
			user: User;
			guildId: GuildID;
			stickers: Array<{name: string; description?: string | null; tags: Array<string>; image: string}>;
		},
		auditLogReason?: string | null,
	): Promise<{
		success: Array<GuildStickerResponse>;
		failed: Array<{name: string; error: string}>;
	}> {
		return this.stickerService.bulkCreateStickers(params, auditLogReason);
	}

	async updateSticker(
		params: {
			userId: UserID;
			guildId: GuildID;
			stickerId: StickerID;
			name: string;
			description?: string | null;
			tags: Array<string>;
		},
		auditLogReason?: string | null,
	): Promise<GuildStickerResponse> {
		return this.stickerService.updateSticker(params, auditLogReason);
	}

	async deleteSticker(
		params: {userId: UserID; guildId: GuildID; stickerId: StickerID; purge?: boolean},
		auditLogReason?: string | null,
	): Promise<void> {
		return this.stickerService.deleteSticker(params, auditLogReason);
	}
}
