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

import type {GuildID, StickerID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {MessageStickerItem} from '@fluxer/api/src/database/types/MessageTypes';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {PackService} from '@fluxer/api/src/pack/PackService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';

export class MessageStickerService {
	constructor(
		private userRepository: IUserRepository,
		private guildRepository: IGuildRepositoryAggregate,
		private packService: PackService,
		private readonly limitConfigService: LimitConfigService,
	) {}

	async computeStickerIds(params: {
		stickerIds: Array<StickerID>;
		userId: UserID | null;
		guildId: GuildID | null;
		hasPermission?: (permission: bigint) => Promise<boolean>;
	}): Promise<Array<MessageStickerItem>> {
		const {stickerIds, userId, guildId, hasPermission} = params;

		const packResolver = await this.packService.createPackExpressionAccessResolver({
			userId,
			type: 'sticker',
		});

		let hasGlobalExpressions = 0;
		if (userId) {
			const user = await this.userRepository.findUnique(userId);
			const ctx = createLimitMatchContext({user});
			hasGlobalExpressions = resolveLimitSafe(
				this.limitConfigService.getConfigSnapshot(),
				ctx,
				'feature_global_expressions',
				0,
			);
		}

		return Promise.all(
			stickerIds.map(async (stickerId) => {
				if (!guildId) {
					if (hasGlobalExpressions === 0) {
						throw InputValidationError.fromCode('sticker', ValidationErrorCodes.CUSTOM_STICKERS_IN_DMS_REQUIRE_PREMIUM);
					}

					const stickerFromAnyGuild = await this.guildRepository.getStickerById(stickerId);
					if (!stickerFromAnyGuild) {
						throw InputValidationError.fromCode('sticker', ValidationErrorCodes.CUSTOM_STICKER_NOT_FOUND);
					}

					const packAccess = await packResolver.resolve(stickerFromAnyGuild.guildId);
					if (packAccess === 'not-accessible') {
						throw InputValidationError.fromCode('sticker', ValidationErrorCodes.CUSTOM_STICKER_NOT_FOUND);
					}

					return {
						sticker_id: stickerFromAnyGuild.id,
						name: stickerFromAnyGuild.name,
						animated: stickerFromAnyGuild.animated,
					};
				}

				const guildSticker = await this.guildRepository.getSticker(stickerId, guildId);
				if (guildSticker) {
					return {
						sticker_id: guildSticker.id,
						name: guildSticker.name,
						animated: guildSticker.animated,
					};
				}

				const stickerFromOtherGuild = await this.guildRepository.getStickerById(stickerId);
				if (!stickerFromOtherGuild) {
					throw InputValidationError.fromCode('sticker', ValidationErrorCodes.CUSTOM_STICKER_NOT_FOUND);
				}

				if (hasGlobalExpressions === 0) {
					throw InputValidationError.fromCode(
						'sticker',
						ValidationErrorCodes.CUSTOM_STICKERS_REQUIRE_PREMIUM_OUTSIDE_SOURCE,
					);
				}

				if (hasPermission) {
					const canUseExternalStickers = await hasPermission(Permissions.USE_EXTERNAL_STICKERS);
					if (!canUseExternalStickers) {
						throw new MissingPermissionsError();
					}
				}

				const packAccess = await packResolver.resolve(stickerFromOtherGuild.guildId);
				if (packAccess === 'not-accessible') {
					throw InputValidationError.fromCode('sticker', ValidationErrorCodes.CUSTOM_STICKER_NOT_FOUND);
				}

				return {
					sticker_id: stickerFromOtherGuild.id,
					name: stickerFromOtherGuild.name,
					animated: stickerFromOtherGuild.animated,
				};
			}),
		);
	}
}
