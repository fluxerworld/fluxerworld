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

import type {UserRow} from '@fluxer/api/src/database/types/UserTypes';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {EntityAssetService, PreparedAssetUpload} from '@fluxer/api/src/infrastructure/EntityAssetService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {User} from '@fluxer/api/src/models/User';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import type {UserAccountUpdatePropagator} from '@fluxer/api/src/user/services/UserAccountUpdatePropagator';
import {deriveDominantAvatarColor} from '@fluxer/api/src/utils/AvatarColorUtils';
import * as EmojiUtils from '@fluxer/api/src/utils/EmojiUtils';
import {MAX_BIO_LENGTH} from '@fluxer/constants/src/LimitConstants';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {UserUpdateRequest} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import {ms} from 'itty-time';

interface UserUpdateMetadata {
	invalidateAuthSessions?: boolean;
}

type UserFieldUpdates = Partial<UserRow>;

export interface ProfileUpdateResult {
	updates: UserFieldUpdates;
	metadata: UserUpdateMetadata;
	preparedAvatarUpload: PreparedAssetUpload | null;
	preparedBannerUpload: PreparedAssetUpload | null;
}

interface UserAccountProfileServiceDeps {
	userAccountRepository: IUserAccountRepository;
	guildRepository: IGuildRepositoryAggregate;
	entityAssetService: EntityAssetService;
	rateLimitService: IRateLimitService;
	updatePropagator: UserAccountUpdatePropagator;
	limitConfigService: LimitConfigService;
}

export class UserAccountProfileService {
	constructor(private readonly deps: UserAccountProfileServiceDeps) {}

	async processProfileUpdates(params: {user: User; data: UserUpdateRequest}): Promise<ProfileUpdateResult> {
		const {user, data} = params;
		const updates: UserFieldUpdates = {
			avatar_hash: user.avatarHash,
			banner_hash: user.bannerHash,
			flags: user.flags,
		};
		const metadata: UserUpdateMetadata = {};

		let preparedAvatarUpload: PreparedAssetUpload | null = null;
		let preparedBannerUpload: PreparedAssetUpload | null = null;

		if (data.bio !== undefined) {
			await this.processBioUpdate({user, bio: data.bio, updates});
		}

		if (data.pronouns !== undefined) {
			await this.processPronounsUpdate({user, pronouns: data.pronouns, updates});
		}

		if (data.accent_color !== undefined) {
			await this.processAccentColorUpdate({user, accentColor: data.accent_color, updates});
		}

		if (data.avatar !== undefined) {
			preparedAvatarUpload = await this.processAvatarUpdate({user, avatar: data.avatar, updates});
		}

		if (data.banner !== undefined) {
			try {
				preparedBannerUpload = await this.processBannerUpdate({user, banner: data.banner, updates});
			} catch (error) {
				if (preparedAvatarUpload) {
					await this.deps.entityAssetService.rollbackAssetUpload(preparedAvatarUpload);
				}
				throw error;
			}
		}

		if (!user.isBot) {
			this.processPremiumBadgeFlags({user, data, updates});
			this.processPremiumOnboardingDismissal({user, data, updates});
			this.processGiftInventoryRead({user, data, updates});
			this.processUsedMobileClient({user, data, updates});
		}

		return {updates, metadata, preparedAvatarUpload, preparedBannerUpload};
	}

	async commitAssetChanges(result: ProfileUpdateResult): Promise<void> {
		if (result.preparedAvatarUpload) {
			await this.deps.entityAssetService.commitAssetChange({
				prepared: result.preparedAvatarUpload,
				deferDeletion: true,
			});
		}

		if (result.preparedBannerUpload) {
			await this.deps.entityAssetService.commitAssetChange({
				prepared: result.preparedBannerUpload,
				deferDeletion: true,
			});
		}
	}

	async rollbackAssetChanges(result: ProfileUpdateResult): Promise<void> {
		if (result.preparedAvatarUpload) {
			await this.deps.entityAssetService.rollbackAssetUpload(result.preparedAvatarUpload);
		}

		if (result.preparedBannerUpload) {
			await this.deps.entityAssetService.rollbackAssetUpload(result.preparedBannerUpload);
		}
	}

	private async processBioUpdate(params: {user: User; bio: string | null; updates: UserFieldUpdates}): Promise<void> {
		const {user, bio, updates} = params;

		if (bio !== user.bio) {
			getMetricsService().counter({name: 'fluxer.users.bio_updated'});
			const bioRateLimit = await this.deps.rateLimitService.checkLimit({
				identifier: `bio_change:${user.id}`,
				maxAttempts: 25,
				windowMs: ms('30 minutes'),
			});

			if (!bioRateLimit.allowed) {
				const minutes = Math.ceil((bioRateLimit.retryAfter || 0) / 60);
				throw InputValidationError.fromCode('bio', ValidationErrorCodes.BIO_CHANGED_TOO_MANY_TIMES, {minutes});
			}

			const ctx = createLimitMatchContext({user});
			const maxBioLength = resolveLimitSafe(
				this.deps.limitConfigService.getConfigSnapshot(),
				ctx,
				'max_bio_length',
				MAX_BIO_LENGTH,
			);

			if (bio && bio.length > maxBioLength) {
				throw InputValidationError.fromCode('bio', ValidationErrorCodes.CONTENT_EXCEEDS_MAX_LENGTH, {
					maxLength: maxBioLength,
				});
			}

			let sanitizedBio = bio;
			if (bio) {
				sanitizedBio = await EmojiUtils.sanitizeCustomEmojis({
					content: bio,
					userId: user.id,
					webhookId: null,
					guildId: null,
					userRepository: this.deps.userAccountRepository,
					guildRepository: this.deps.guildRepository,
					limitConfigService: this.deps.limitConfigService,
				});
			}

			updates.bio = sanitizedBio;
		}
	}

	private async processPronounsUpdate(params: {
		user: User;
		pronouns: string | null;
		updates: UserFieldUpdates;
	}): Promise<void> {
		const {user, pronouns, updates} = params;

		if (pronouns !== user.pronouns) {
			getMetricsService().counter({name: 'fluxer.users.pronouns_updated'});
			const pronounsRateLimit = await this.deps.rateLimitService.checkLimit({
				identifier: `pronouns_change:${user.id}`,
				maxAttempts: 25,
				windowMs: ms('30 minutes'),
			});

			if (!pronounsRateLimit.allowed) {
				const minutes = Math.ceil((pronounsRateLimit.retryAfter || 0) / 60);
				throw InputValidationError.fromCode('pronouns', ValidationErrorCodes.PRONOUNS_CHANGED_TOO_MANY_TIMES, {
					minutes,
				});
			}

			updates.pronouns = pronouns;
		}
	}

	private async processAccentColorUpdate(params: {
		user: User;
		accentColor: number | null;
		updates: UserFieldUpdates;
	}): Promise<void> {
		const {user, accentColor, updates} = params;

		if (accentColor !== user.accentColor) {
			getMetricsService().counter({name: 'fluxer.users.accent_color_updated'});
			const accentColorRateLimit = await this.deps.rateLimitService.checkLimit({
				identifier: `accent_color_change:${user.id}`,
				maxAttempts: 25,
				windowMs: ms('30 minutes'),
			});

			if (!accentColorRateLimit.allowed) {
				const minutes = Math.ceil((accentColorRateLimit.retryAfter || 0) / 60);
				throw InputValidationError.fromCode('accent_color', ValidationErrorCodes.ACCENT_COLOR_CHANGED_TOO_MANY_TIMES, {
					minutes,
				});
			}

			updates.accent_color = accentColor;
		}
	}

	private async processAvatarUpdate(params: {
		user: User;
		avatar: string | null;
		updates: UserFieldUpdates;
	}): Promise<PreparedAssetUpload | null> {
		return await withBusinessSpan(
			'fluxer.user.avatar_update',
			'fluxer.users.avatars_updated',
			{
				user_id: params.user.id.toString(),
				avatar_type: params.avatar ? 'custom' : 'default',
			},
			async () => {
				const {user, avatar, updates} = params;

				if (avatar === null) {
					updates.avatar_hash = null;
					updates.avatar_color = null;
					if (user.avatarHash) {
						return await this.deps.entityAssetService.prepareAssetUpload({
							assetType: 'avatar',
							entityType: 'user',
							entityId: user.id,
							previousHash: user.avatarHash,
							base64Image: null,
							errorPath: 'avatar',
						});
					}
					return null;
				}

				const avatarRateLimit = await this.deps.rateLimitService.checkLimit({
					identifier: `avatar_change:${user.id}`,
					maxAttempts: 25,
					windowMs: ms('30 minutes'),
				});

				if (!avatarRateLimit.allowed) {
					const minutes = Math.ceil((avatarRateLimit.retryAfter || 0) / 60);
					throw InputValidationError.fromCode('avatar', ValidationErrorCodes.AVATAR_CHANGED_TOO_MANY_TIMES, {minutes});
				}

				const prepared = await this.deps.entityAssetService.prepareAssetUpload({
					assetType: 'avatar',
					entityType: 'user',
					entityId: user.id,
					previousHash: user.avatarHash,
					base64Image: avatar,
					errorPath: 'avatar',
				});

				const ctx = createLimitMatchContext({user});
				const hasAnimatedAvatar = resolveLimitSafe(
					this.deps.limitConfigService.getConfigSnapshot(),
					ctx,
					'feature_animated_avatar',
					0,
				);

				if (prepared.isAnimated && hasAnimatedAvatar === 0) {
					await this.deps.entityAssetService.rollbackAssetUpload(prepared);
					throw InputValidationError.fromCode('avatar', ValidationErrorCodes.ANIMATED_AVATARS_REQUIRE_PREMIUM);
				}

				if (prepared.imageBuffer) {
					const derivedColor = await deriveDominantAvatarColor(prepared.imageBuffer);
					if (derivedColor !== user.avatarColor) {
						updates.avatar_color = derivedColor;
					}
				}

				if (prepared.newHash !== user.avatarHash) {
					updates.avatar_hash = prepared.newHash;
					return prepared;
				}

				return null;
			},
		);
	}

	private async processBannerUpdate(params: {
		user: User;
		banner: string | null;
		updates: UserFieldUpdates;
	}): Promise<PreparedAssetUpload | null> {
		const {user, banner, updates} = params;

		if (banner === null) {
			updates.banner_color = null;
		}

		getMetricsService().counter({name: 'fluxer.users.banner_updated'});

		const ctx = createLimitMatchContext({user});
		const hasAnimatedBanner = resolveLimitSafe(
			this.deps.limitConfigService.getConfigSnapshot(),
			ctx,
			'feature_animated_banner',
			0,
		);

		if (banner && hasAnimatedBanner === 0) {
			throw InputValidationError.fromCode('banner', ValidationErrorCodes.BANNERS_REQUIRE_PREMIUM);
		}

		const bannerRateLimit = await this.deps.rateLimitService.checkLimit({
			identifier: `banner_change:${user.id}`,
			maxAttempts: 25,
			windowMs: ms('30 minutes'),
		});

		if (!bannerRateLimit.allowed) {
			const minutes = Math.ceil((bannerRateLimit.retryAfter || 0) / 60);
			throw InputValidationError.fromCode('banner', ValidationErrorCodes.BANNER_CHANGED_TOO_MANY_TIMES, {minutes});
		}

		const prepared = await this.deps.entityAssetService.prepareAssetUpload({
			assetType: 'banner',
			entityType: 'user',
			entityId: user.id,
			previousHash: user.bannerHash,
			base64Image: banner,
			errorPath: 'banner',
		});

		if (prepared.isAnimated && hasAnimatedBanner === 0) {
			await this.deps.entityAssetService.rollbackAssetUpload(prepared);
			throw InputValidationError.fromCode('banner', ValidationErrorCodes.ANIMATED_AVATARS_REQUIRE_PREMIUM);
		}

		if (banner !== null && prepared.imageBuffer) {
			const derivedColor = await deriveDominantAvatarColor(prepared.imageBuffer);
			if (derivedColor !== user.bannerColor) {
				updates.banner_color = derivedColor;
			}
		}

		if (prepared.newHash !== user.bannerHash) {
			updates.banner_hash = prepared.newHash;
			return prepared;
		}

		return null;
	}

	private processPremiumBadgeFlags(params: {user: User; data: UserUpdateRequest; updates: UserFieldUpdates}): void {
		const {user, data, updates} = params;
		let flagsUpdated = false;
		let newFlags = user.flags;

		if (data.premium_badge_hidden !== undefined) {
			if (data.premium_badge_hidden) {
				newFlags = newFlags | UserFlags.PREMIUM_BADGE_HIDDEN;
			} else {
				newFlags = newFlags & ~UserFlags.PREMIUM_BADGE_HIDDEN;
			}
			flagsUpdated = true;
		}

		if (data.premium_badge_masked !== undefined) {
			if (data.premium_badge_masked) {
				newFlags = newFlags | UserFlags.PREMIUM_BADGE_MASKED;
			} else {
				newFlags = newFlags & ~UserFlags.PREMIUM_BADGE_MASKED;
			}
			flagsUpdated = true;
		}

		if (data.premium_badge_timestamp_hidden !== undefined) {
			if (data.premium_badge_timestamp_hidden) {
				newFlags = newFlags | UserFlags.PREMIUM_BADGE_TIMESTAMP_HIDDEN;
			} else {
				newFlags = newFlags & ~UserFlags.PREMIUM_BADGE_TIMESTAMP_HIDDEN;
			}
			flagsUpdated = true;
		}

		if (data.premium_badge_sequence_hidden !== undefined) {
			if (data.premium_badge_sequence_hidden) {
				newFlags = newFlags | UserFlags.PREMIUM_BADGE_SEQUENCE_HIDDEN;
			} else {
				newFlags = newFlags & ~UserFlags.PREMIUM_BADGE_SEQUENCE_HIDDEN;
			}
			flagsUpdated = true;
		}

		if (data.premium_enabled_override !== undefined) {
			if (!(user.flags & UserFlags.STAFF)) {
				throw new MissingAccessError();
			}

			if (data.premium_enabled_override) {
				newFlags = newFlags | UserFlags.PREMIUM_ENABLED_OVERRIDE;
			} else {
				newFlags = newFlags & ~UserFlags.PREMIUM_ENABLED_OVERRIDE;
			}
			flagsUpdated = true;
		}

		if (flagsUpdated) {
			updates.flags = newFlags;
		}
	}

	private processPremiumOnboardingDismissal(params: {
		user: User;
		data: UserUpdateRequest;
		updates: UserFieldUpdates;
	}): void {
		const {data, updates} = params;

		if (data.has_dismissed_premium_onboarding !== undefined) {
			if (data.has_dismissed_premium_onboarding) {
				updates.premium_onboarding_dismissed_at = new Date();
			}
		}
	}

	private processGiftInventoryRead(params: {user: User; data: UserUpdateRequest; updates: UserFieldUpdates}): void {
		const {user, data, updates} = params;

		if (data.has_unread_gift_inventory === false) {
			updates.gift_inventory_client_seq = user.giftInventoryServerSeq;
		}
	}

	private processUsedMobileClient(params: {user: User; data: UserUpdateRequest; updates: UserFieldUpdates}): void {
		const {user, data, updates} = params;

		if (data.used_mobile_client !== undefined) {
			let newFlags = updates.flags ?? user.flags;
			if (data.used_mobile_client) {
				newFlags = newFlags | UserFlags.USED_MOBILE_CLIENT;
			} else {
				newFlags = newFlags & ~UserFlags.USED_MOBILE_CLIENT;
			}
			updates.flags = newFlags;
		}
	}
}
