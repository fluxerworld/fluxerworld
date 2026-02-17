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

import {createEmojiID, type EmojiID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {PackService} from '@fluxer/api/src/pack/PackService';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {CustomStatusPayload} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import type {z} from 'zod';

export interface ValidatedCustomStatus {
	text: string | null;
	expiresAt: Date | null;
	emojiId: EmojiID | null;
	emojiName: string | null;
	emojiAnimated: boolean;
}

export class CustomStatusValidator {
	constructor(
		private readonly userAccountRepository: IUserAccountRepository,
		private readonly guildRepository: IGuildRepositoryAggregate,
		private readonly packService: PackService,
		private readonly limitConfigService: LimitConfigService,
	) {}

	async validate(userId: UserID, payload: z.infer<typeof CustomStatusPayload>): Promise<ValidatedCustomStatus> {
		const text = payload.text ?? null;
		const expiresAt = payload.expires_at ?? null;
		let emojiId: EmojiID | null = null;
		let emojiName: string | null = null;
		let emojiAnimated = false;

		if (payload.emoji_id != null) {
			emojiId = createEmojiID(payload.emoji_id);

			const emoji = await this.guildRepository.getEmojiById(emojiId);
			if (!emoji) {
				throw InputValidationError.fromCode('custom_status.emoji_id', ValidationErrorCodes.CUSTOM_EMOJI_NOT_FOUND);
			}

			const user = await this.userAccountRepository.findUnique(userId);
			const ctx = createLimitMatchContext({user});
			const hasGlobalExpressions = resolveLimitSafe(
				this.limitConfigService.getConfigSnapshot(),
				ctx,
				'feature_global_expressions',
				0,
			);

			if (hasGlobalExpressions === 0) {
				throw InputValidationError.fromCode(
					'custom_status.emoji_id',
					ValidationErrorCodes.PREMIUM_REQUIRED_FOR_CUSTOM_EMOJI,
				);
			}

			const guildMember = await this.guildRepository.getMember(emoji.guildId, userId);

			let hasAccess = guildMember !== null;
			if (!hasAccess) {
				const resolver = await this.packService.createPackExpressionAccessResolver({
					userId,
					type: 'emoji',
				});
				const resolution = await resolver.resolve(emoji.guildId);
				hasAccess = resolution === 'accessible';
			}

			if (!hasAccess) {
				throw InputValidationError.fromCode(
					'custom_status.emoji_id',
					ValidationErrorCodes.EMOJI_REQUIRES_GUILD_OR_PACK_ACCESS,
				);
			}

			emojiName = emoji.name;
			emojiAnimated = emoji.isAnimated;
		} else if (payload.emoji_name != null) {
			emojiName = payload.emoji_name;
		}

		return {
			text,
			expiresAt,
			emojiId,
			emojiName,
			emojiAnimated,
		};
	}
}
