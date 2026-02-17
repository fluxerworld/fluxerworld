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

import {createStickerID, type GuildID, type StickerID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {mapGuildStickersWithUsersToResponse, mapGuildStickerToResponse} from '@fluxer/api/src/guild/GuildModel';
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
import type {GuildSticker} from '@fluxer/api/src/models/GuildSticker';
import type {User} from '@fluxer/api/src/models/User';
import {getCachedUserPartialResponse} from '@fluxer/api/src/user/UserCacheHelpers';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {
	MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED,
	MAX_GUILD_STICKERS,
	MAX_GUILD_STICKERS_MORE_STICKERS,
} from '@fluxer/constants/src/LimitConstants';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {MaxGuildStickersStaticError} from '@fluxer/errors/src/domains/guild/MaxGuildStickersStaticError';
import {UnknownGuildStickerError} from '@fluxer/errors/src/domains/guild/UnknownGuildStickerError';
import {resolveLimit} from '@fluxer/limits/src/LimitResolver';
import type {
	GuildStickerResponse,
	GuildStickerWithUserResponse,
} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

export class StickerService {
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

	async getStickers(params: {
		userId: UserID;
		guildId: GuildID;
		requestCache: RequestCache;
	}): Promise<Array<GuildStickerWithUserResponse>> {
		const {userId, guildId, requestCache} = params;
		await this.contentHelpers.getGuildData({userId, guildId});

		const stickers = await this.guildRepository.listStickers(guildId);
		return await mapGuildStickersWithUsersToResponse(stickers, this.userCacheService, requestCache);
	}

	async getStickerUser(params: {
		userId: UserID;
		guildId: GuildID;
		stickerId: StickerID;
		requestCache: RequestCache;
	}): Promise<UserPartialResponse> {
		const {userId, guildId, stickerId, requestCache} = params;
		await this.contentHelpers.getGuildData({userId, guildId});

		const sticker = await this.guildRepository.getSticker(stickerId, guildId);
		if (!sticker) throw new UnknownGuildStickerError();

		const userPartial = await getCachedUserPartialResponse({
			userId: sticker.creatorId,
			userCacheService: this.userCacheService,
			requestCache,
		});
		return userPartial;
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
		const {user, guildId, name, description, tags, image} = params;
		const guildData = await this.contentHelpers.getGuildData({userId: user.id, guildId});
		await this.contentHelpers.checkCreateExpressionsPermission({userId: user.id, guildId});

		const allStickers = await this.guildRepository.listStickers(guildId);
		const stickerCount = allStickers.length;

		const {animated, imageBuffer} = await this.avatarService.processSticker({errorPath: 'image', base64Image: image});

		const guildFeatures = guildData.features;
		const hasMoreStickers = guildFeatures.includes(GuildFeatures.MORE_STICKERS);
		const hasUnlimitedStickers = guildFeatures.includes(GuildFeatures.UNLIMITED_STICKERS);
		const useElevatedStickerLimits = hasMoreStickers || hasUnlimitedStickers;
		const limitKey: LimitKey = useElevatedStickerLimits ? 'max_guild_stickers_more' : 'max_guild_stickers';
		const fallbackLimit = hasUnlimitedStickers
			? MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED
			: useElevatedStickerLimits
				? MAX_GUILD_STICKERS_MORE_STICKERS
				: MAX_GUILD_STICKERS;
		const maxStickers = this.resolveGuildLimit(limitKey, fallbackLimit, guildFeatures);

		if (stickerCount >= maxStickers) {
			throw new MaxGuildStickersStaticError(maxStickers);
		}

		const stickerId = createStickerID(await this.snowflakeService.generate());
		await this.avatarService.uploadSticker({prefix: 'stickers', stickerId, imageBuffer});

		const sticker = await this.guildRepository.upsertSticker({
			guild_id: guildId,
			sticker_id: stickerId,
			name,
			description: description ?? null,
			animated,
			tags,
			creator_id: user.id,
			version: 1,
		});

		const updatedStickers = [...allStickers, sticker];
		await this.dispatchGuildStickersUpdate({guildId, stickers: updatedStickers});

		await this.contentHelpers.recordAuditLog({
			guildId,
			userId: user.id,
			action: AuditLogActionType.STICKER_CREATE,
			targetId: sticker.id,
			auditLogReason: auditLogReason ?? null,
			changes: this.contentHelpers.guildAuditLogService.computeChanges(
				null,
				this.contentHelpers.serializeStickerForAudit(sticker),
			),
		});

		return mapGuildStickerToResponse(sticker);
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
		const {user, guildId, stickers} = params;
		const guildData = await this.contentHelpers.getGuildData({userId: user.id, guildId});
		await this.contentHelpers.checkCreateExpressionsPermission({userId: user.id, guildId});

		const allStickers = await this.guildRepository.listStickers(guildId);

		const guildFeatures = guildData.features;
		const hasMoreStickers = guildFeatures.includes(GuildFeatures.MORE_STICKERS);
		const hasUnlimitedStickers = guildFeatures.includes(GuildFeatures.UNLIMITED_STICKERS);
		const useElevatedStickerLimits = hasMoreStickers || hasUnlimitedStickers;
		const limitKey: LimitKey = useElevatedStickerLimits ? 'max_guild_stickers_more' : 'max_guild_stickers';
		const fallbackLimit = hasUnlimitedStickers
			? MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED
			: useElevatedStickerLimits
				? MAX_GUILD_STICKERS_MORE_STICKERS
				: MAX_GUILD_STICKERS;
		const maxStickers = this.resolveGuildLimit(limitKey, fallbackLimit, guildFeatures);

		let stickerCount = allStickers.length;

		const success: Array<GuildStickerResponse> = [];
		const failed: Array<{name: string; error: string}> = [];
		const newStickers: Array<GuildSticker> = [];

		for (const stickerData of stickers) {
			try {
				const {animated, imageBuffer} = await this.avatarService.processSticker({
					errorPath: `stickers[${success.length + failed.length}].image`,
					base64Image: stickerData.image,
				});

				if (stickerCount >= maxStickers) {
					const limitLabel = `${Math.floor(maxStickers)}`;
					failed.push({name: stickerData.name, error: `Maximum stickers reached (${limitLabel})`});
					continue;
				}

				const stickerId = createStickerID(await this.snowflakeService.generate());
				await this.avatarService.uploadSticker({prefix: 'stickers', stickerId, imageBuffer});

				const sticker = await this.guildRepository.upsertSticker({
					guild_id: guildId,
					sticker_id: stickerId,
					name: stickerData.name,
					description: stickerData.description ?? null,
					tags: stickerData.tags,
					animated,
					creator_id: user.id,
					version: 1,
				});

				stickerCount++;

				newStickers.push(sticker);
				success.push(mapGuildStickerToResponse(sticker));
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				failed.push({name: stickerData.name, error: errorMessage});
			}
		}

		if (newStickers.length > 0) {
			const updatedStickers = [...allStickers, ...newStickers];
			await this.dispatchGuildStickersUpdate({guildId, stickers: updatedStickers});

			await Promise.all(
				newStickers.map((sticker) =>
					this.contentHelpers.recordAuditLog({
						guildId,
						userId: user.id,
						action: AuditLogActionType.STICKER_CREATE,
						targetId: sticker.id,
						auditLogReason: auditLogReason ?? null,
						changes: this.contentHelpers.guildAuditLogService.computeChanges(
							null,
							this.contentHelpers.serializeStickerForAudit(sticker),
						),
					}),
				),
			);
		}

		return {success, failed};
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
		const {userId, guildId, stickerId, name, description, tags} = params;

		const allStickers = await this.guildRepository.listStickers(guildId);
		const sticker = allStickers.find((e) => e.id === stickerId);
		if (!sticker) throw new UnknownGuildStickerError();

		await this.contentHelpers.checkModifyExpressionPermission({userId, guildId, creatorId: sticker.creatorId});
		const previousSnapshot = this.contentHelpers.serializeStickerForAudit(sticker);

		const updatedSticker = await this.guildRepository.upsertSticker({
			...sticker.toRow(),
			name,
			description: description ?? null,
			tags,
		});
		const updatedStickers = allStickers.map((e) => (e.id === stickerId ? updatedSticker : e));
		await this.dispatchGuildStickersUpdate({guildId, stickers: updatedStickers});

		await this.contentHelpers.recordAuditLog({
			guildId,
			userId,
			action: AuditLogActionType.STICKER_UPDATE,
			targetId: stickerId,
			auditLogReason: auditLogReason ?? null,
			changes: this.contentHelpers.guildAuditLogService.computeChanges(
				previousSnapshot,
				this.contentHelpers.serializeStickerForAudit(updatedSticker),
			),
		});

		return mapGuildStickerToResponse(updatedSticker);
	}

	async deleteSticker(
		params: {userId: UserID; guildId: GuildID; stickerId: StickerID; purge?: boolean},
		auditLogReason?: string | null,
	): Promise<void> {
		const {userId, guildId, stickerId, purge = false} = params;
		const guildData = await this.contentHelpers.getGuildData({userId, guildId});

		if (purge && !guildData.features.includes(GuildFeatures.EXPRESSION_PURGE_ALLOWED)) {
			throw new MissingAccessError();
		}

		const allStickers = await this.guildRepository.listStickers(guildId);
		const sticker = allStickers.find((e) => e.id === stickerId);
		if (!sticker) throw new UnknownGuildStickerError();

		await this.contentHelpers.checkModifyExpressionPermission({userId, guildId, creatorId: sticker.creatorId});
		const previousSnapshot = this.contentHelpers.serializeStickerForAudit(sticker);

		await this.guildRepository.deleteSticker(guildId, stickerId);
		const updatedStickers = allStickers.filter((e) => e.id !== stickerId);
		await this.dispatchGuildStickersUpdate({guildId, stickers: updatedStickers});

		if (purge) {
			await this.assetPurger.purgeSticker(sticker.id.toString());
		}

		await this.contentHelpers.recordAuditLog({
			guildId,
			userId,
			action: AuditLogActionType.STICKER_DELETE,
			targetId: stickerId,
			auditLogReason: auditLogReason ?? null,
			changes: this.contentHelpers.guildAuditLogService.computeChanges(previousSnapshot, null),
		});
	}

	private async dispatchGuildStickersUpdate(params: {guildId: GuildID; stickers: Array<GuildSticker>}): Promise<void> {
		const {guildId, stickers} = params;
		await this.gatewayService.dispatchGuild({
			guildId,
			event: 'GUILD_STICKERS_UPDATE',
			data: {stickers: stickers.map(mapGuildStickerToResponse)},
		});
	}
}
