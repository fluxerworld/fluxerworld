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

import {createEmojiID, type EmojiID, type GuildID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {mapGuildEmojisWithUsersToResponse, mapGuildEmojiToResponse} from '@fluxer/api/src/guild/GuildModel';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {ContentHelpers} from '@fluxer/api/src/guild/services/content/ContentHelpers';
import type {ExpressionAssetPurger} from '@fluxer/api/src/guild/services/content/ExpressionAssetPurger';
import type {AvatarService} from '@fluxer/api/src/infrastructure/AvatarService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {GuildEmoji} from '@fluxer/api/src/models/GuildEmoji';
import type {User} from '@fluxer/api/src/models/User';
import {getCachedUserPartialResponse} from '@fluxer/api/src/user/UserCacheHelpers';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {
	MAX_GUILD_EMOJIS_ANIMATED,
	MAX_GUILD_EMOJIS_ANIMATED_MORE_EMOJI,
	MAX_GUILD_EMOJIS_STATIC,
	MAX_GUILD_EMOJIS_STATIC_MORE_EMOJI,
	MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED,
} from '@fluxer/constants/src/LimitConstants';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {MaxGuildEmojisAnimatedError} from '@fluxer/errors/src/domains/guild/MaxGuildEmojisAnimatedError';
import {MaxGuildEmojisStaticError} from '@fluxer/errors/src/domains/guild/MaxGuildEmojisStaticError';
import {UnknownGuildEmojiError} from '@fluxer/errors/src/domains/guild/UnknownGuildEmojiError';
import {resolveLimit} from '@fluxer/limits/src/LimitResolver';
import type {GuildEmojiResponse, GuildEmojiWithUserResponse} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

export class EmojiService {
	constructor(
		private readonly guildRepository: IGuildRepositoryAggregate,
		private readonly userCacheService: UserCacheService,
		private readonly gatewayService: IGatewayService,
		private readonly avatarService: AvatarService,
		private readonly snowflakeService: SnowflakeService,
		private readonly contentHelpers: ContentHelpers,
		private readonly assetPurger: ExpressionAssetPurger,
		private readonly limitConfigService: LimitConfigService,
	) {}

	private resolveGuildLimit(key: LimitKey, fallback: number, guildFeatures: Iterable<string> | null): number {
		const ctx = createLimitMatchContext({user: null, guildFeatures});
		const resolved = resolveLimit(this.limitConfigService.getConfigSnapshot(), ctx, key, {
			evaluationContext: 'guild',
		});
		if (!Number.isFinite(resolved) || resolved < 0) {
			return fallback;
		}
		return Math.floor(resolved);
	}

	async getEmojis(params: {
		userId: UserID;
		guildId: GuildID;
		requestCache: RequestCache;
	}): Promise<Array<GuildEmojiWithUserResponse>> {
		const {userId, guildId, requestCache} = params;
		await this.contentHelpers.getGuildData({userId, guildId});

		const emojis = await this.guildRepository.listEmojis(guildId);
		return await mapGuildEmojisWithUsersToResponse(emojis, this.userCacheService, requestCache);
	}

	async getEmojiUser(params: {
		userId: UserID;
		guildId: GuildID;
		emojiId: EmojiID;
		requestCache: RequestCache;
	}): Promise<UserPartialResponse> {
		const {userId, guildId, emojiId, requestCache} = params;
		await this.contentHelpers.getGuildData({userId, guildId});

		const emoji = await this.guildRepository.getEmoji(emojiId, guildId);
		if (!emoji) throw new UnknownGuildEmojiError();

		const userPartial = await getCachedUserPartialResponse({
			userId: emoji.creatorId,
			userCacheService: this.userCacheService,
			requestCache,
		});
		return userPartial;
	}

	async createEmoji(
		params: {user: User; guildId: GuildID; name: string; image: string},
		auditLogReason?: string | null,
	): Promise<GuildEmojiResponse> {
		const {user, guildId, name, image} = params;
		const guildData = await this.contentHelpers.getGuildData({userId: user.id, guildId});
		await this.contentHelpers.checkCreateExpressionsPermission({userId: user.id, guildId});

		const allEmojis = await this.guildRepository.listEmojis(guildId);
		const staticCount = allEmojis.filter((e) => !e.isAnimated).length;
		const animatedCount = allEmojis.filter((e) => e.isAnimated).length;

		const {animated, imageBuffer, contentType} = await this.avatarService.processEmoji({
			errorPath: 'image',
			base64Image: image,
		});

		const guildFeatures = guildData.features;
		const hasMoreEmoji = guildFeatures.includes(GuildFeatures.MORE_EMOJI);
		const hasUnlimitedEmoji = guildFeatures.includes(GuildFeatures.UNLIMITED_EMOJI);
		const useElevatedEmojiLimits = hasMoreEmoji || hasUnlimitedEmoji;
		const staticKey: LimitKey = useElevatedEmojiLimits ? 'max_guild_emojis_static_more' : 'max_guild_emojis_static';
		const animatedKey: LimitKey = useElevatedEmojiLimits
			? 'max_guild_emojis_animated_more'
			: 'max_guild_emojis_animated';
		const fallbackStatic = hasUnlimitedEmoji
			? MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED
			: useElevatedEmojiLimits
				? MAX_GUILD_EMOJIS_STATIC_MORE_EMOJI
				: MAX_GUILD_EMOJIS_STATIC;
		const fallbackAnimated = hasUnlimitedEmoji
			? MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED
			: useElevatedEmojiLimits
				? MAX_GUILD_EMOJIS_ANIMATED_MORE_EMOJI
				: MAX_GUILD_EMOJIS_ANIMATED;
		const maxStatic = this.resolveGuildLimit(staticKey, fallbackStatic, guildFeatures);
		const maxAnimated = this.resolveGuildLimit(animatedKey, fallbackAnimated, guildFeatures);

		if (!animated && staticCount >= maxStatic) {
			throw new MaxGuildEmojisStaticError(maxStatic);
		}
		if (animated && animatedCount >= maxAnimated) {
			throw new MaxGuildEmojisAnimatedError(maxAnimated);
		}

		const emojiId = createEmojiID(await this.snowflakeService.generate());
		await this.avatarService.uploadEmoji({
			prefix: 'emojis',
			emojiId,
			imageBuffer,
			contentType,
		});

		const emoji = await this.guildRepository.upsertEmoji({
			guild_id: guildId,
			emoji_id: emojiId,
			name,
			creator_id: user.id,
			animated,
			version: 1,
		});

		const updatedEmojis = [...allEmojis, emoji];
		await this.dispatchGuildEmojisUpdate({guildId, emojis: updatedEmojis});

		await this.contentHelpers.recordAuditLog({
			guildId,
			userId: user.id,
			action: AuditLogActionType.EMOJI_CREATE,
			targetId: emoji.id,
			auditLogReason: auditLogReason ?? null,
			changes: this.contentHelpers.guildAuditLogService.computeChanges(
				null,
				this.contentHelpers.serializeEmojiForAudit(emoji),
			),
		});
		return mapGuildEmojiToResponse(emoji);
	}

	async bulkCreateEmojis(
		params: {user: User; guildId: GuildID; emojis: Array<{name: string; image: string}>},
		auditLogReason?: string | null,
	): Promise<{
		success: Array<GuildEmojiResponse>;
		failed: Array<{name: string; error: string}>;
	}> {
		const {user, guildId, emojis} = params;
		const guildData = await this.contentHelpers.getGuildData({userId: user.id, guildId});
		await this.contentHelpers.checkCreateExpressionsPermission({userId: user.id, guildId});

		const allEmojis = await this.guildRepository.listEmojis(guildId);

		const guildFeatures = guildData.features;
		const hasMoreEmoji = guildFeatures.includes(GuildFeatures.MORE_EMOJI);
		const hasUnlimitedEmoji = guildFeatures.includes(GuildFeatures.UNLIMITED_EMOJI);
		const useElevatedEmojiLimits = hasMoreEmoji || hasUnlimitedEmoji;
		const staticKey: LimitKey = useElevatedEmojiLimits ? 'max_guild_emojis_static_more' : 'max_guild_emojis_static';
		const animatedKey: LimitKey = useElevatedEmojiLimits
			? 'max_guild_emojis_animated_more'
			: 'max_guild_emojis_animated';
		const fallbackStatic = hasUnlimitedEmoji
			? MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED
			: useElevatedEmojiLimits
				? MAX_GUILD_EMOJIS_STATIC_MORE_EMOJI
				: MAX_GUILD_EMOJIS_STATIC;
		const fallbackAnimated = hasUnlimitedEmoji
			? MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED
			: useElevatedEmojiLimits
				? MAX_GUILD_EMOJIS_ANIMATED_MORE_EMOJI
				: MAX_GUILD_EMOJIS_ANIMATED;
		const maxStatic = this.resolveGuildLimit(staticKey, fallbackStatic, guildFeatures);
		const maxAnimated = this.resolveGuildLimit(animatedKey, fallbackAnimated, guildFeatures);

		let staticCount = allEmojis.filter((e) => !e.isAnimated).length;
		let animatedCount = allEmojis.filter((e) => e.isAnimated).length;

		const success: Array<GuildEmojiResponse> = [];
		const failed: Array<{name: string; error: string}> = [];
		const newEmojis: Array<GuildEmoji> = [];

		for (const emojiData of emojis) {
			try {
				const {animated, imageBuffer, contentType} = await this.avatarService.processEmoji({
					errorPath: `emojis[${success.length + failed.length}].image`,
					base64Image: emojiData.image,
				});

				if (!animated && staticCount >= maxStatic) {
					const limitLabel = `${Math.floor(maxStatic)}`;
					failed.push({name: emojiData.name, error: `Maximum static emojis reached (${limitLabel})`});
					continue;
				}
				if (animated && animatedCount >= maxAnimated) {
					const limitLabel = `${Math.floor(maxAnimated)}`;
					failed.push({name: emojiData.name, error: `Maximum animated emojis reached (${limitLabel})`});
					continue;
				}

				const emojiId = createEmojiID(await this.snowflakeService.generate());
				await this.avatarService.uploadEmoji({
					prefix: 'emojis',
					emojiId,
					imageBuffer,
					contentType,
				});

				const emoji = await this.guildRepository.upsertEmoji({
					guild_id: guildId,
					emoji_id: emojiId,
					name: emojiData.name,
					animated,
					creator_id: user.id,
					version: 1,
				});

				if (animated) {
					animatedCount++;
				} else {
					staticCount++;
				}

				newEmojis.push(emoji);
				success.push(mapGuildEmojiToResponse(emoji));
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				failed.push({name: emojiData.name, error: errorMessage});
			}
		}

		if (newEmojis.length > 0) {
			const updatedEmojis = [...allEmojis, ...newEmojis];
			await this.dispatchGuildEmojisUpdate({guildId, emojis: updatedEmojis});

			await Promise.all(
				newEmojis.map((emoji) =>
					this.contentHelpers.recordAuditLog({
						guildId,
						userId: user.id,
						action: AuditLogActionType.EMOJI_CREATE,
						targetId: emoji.id,
						auditLogReason: auditLogReason ?? null,
						changes: this.contentHelpers.guildAuditLogService.computeChanges(
							null,
							this.contentHelpers.serializeEmojiForAudit(emoji),
						),
					}),
				),
			);
		}

		return {success, failed};
	}

	async updateEmoji(
		params: {userId: UserID; guildId: GuildID; emojiId: EmojiID; name: string},
		auditLogReason?: string | null,
	): Promise<GuildEmojiResponse> {
		const {userId, guildId, emojiId, name} = params;

		const allEmojis = await this.guildRepository.listEmojis(guildId);
		const emoji = allEmojis.find((e) => e.id === emojiId);
		if (!emoji) throw new UnknownGuildEmojiError();

		await this.contentHelpers.checkModifyExpressionPermission({userId, guildId, creatorId: emoji.creatorId});
		const previousSnapshot = this.contentHelpers.serializeEmojiForAudit(emoji);

		const updatedEmoji = await this.guildRepository.upsertEmoji({...emoji.toRow(), name});
		const updatedEmojis = allEmojis.map((e) => (e.id === emojiId ? updatedEmoji : e));
		await this.dispatchGuildEmojisUpdate({guildId, emojis: updatedEmojis});

		await this.contentHelpers.recordAuditLog({
			guildId,
			userId,
			action: AuditLogActionType.EMOJI_UPDATE,
			targetId: emojiId,
			auditLogReason: auditLogReason ?? null,
			changes: this.contentHelpers.guildAuditLogService.computeChanges(
				previousSnapshot,
				this.contentHelpers.serializeEmojiForAudit(updatedEmoji),
			),
		});
		return mapGuildEmojiToResponse(updatedEmoji);
	}

	async deleteEmoji(
		params: {userId: UserID; guildId: GuildID; emojiId: EmojiID; purge?: boolean},
		auditLogReason?: string | null,
	): Promise<void> {
		const {userId, guildId, emojiId, purge = false} = params;
		const guildData = await this.contentHelpers.getGuildData({userId, guildId});

		if (purge && !guildData.features.includes(GuildFeatures.EXPRESSION_PURGE_ALLOWED)) {
			throw new MissingAccessError();
		}

		const allEmojis = await this.guildRepository.listEmojis(guildId);
		const emoji = allEmojis.find((e) => e.id === emojiId);
		if (!emoji) throw new UnknownGuildEmojiError();

		await this.contentHelpers.checkModifyExpressionPermission({userId, guildId, creatorId: emoji.creatorId});
		const previousSnapshot = this.contentHelpers.serializeEmojiForAudit(emoji);

		await this.guildRepository.deleteEmoji(guildId, emojiId);
		const updatedEmojis = allEmojis.filter((e) => e.id !== emojiId);
		await this.dispatchGuildEmojisUpdate({guildId, emojis: updatedEmojis});

		if (purge) {
			await this.assetPurger.purgeEmoji(emoji.id.toString());
		}

		await this.contentHelpers.recordAuditLog({
			guildId,
			userId,
			action: AuditLogActionType.EMOJI_DELETE,
			targetId: emojiId,
			auditLogReason: auditLogReason ?? null,
			changes: this.contentHelpers.guildAuditLogService.computeChanges(previousSnapshot, null),
		});
	}

	private async dispatchGuildEmojisUpdate(params: {guildId: GuildID; emojis: Array<GuildEmoji>}): Promise<void> {
		const {guildId, emojis} = params;
		await this.gatewayService.dispatchGuild({
			guildId,
			event: 'GUILD_EMOJIS_UPDATE',
			data: {emojis: emojis.map(mapGuildEmojiToResponse)},
		});
	}
}
