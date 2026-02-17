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

import {randomBytes} from 'node:crypto';
import type {ApplicationID, UserID} from '@fluxer/api/src/BrandedTypes';
import {applicationIdToUserId} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {ApplicationRow} from '@fluxer/api/src/database/types/OAuth2Types';
import type {UserRow} from '@fluxer/api/src/database/types/UserTypes';
import type {DiscriminatorService} from '@fluxer/api/src/infrastructure/DiscriminatorService';
import type {EntityAssetService, PreparedAssetUpload} from '@fluxer/api/src/infrastructure/EntityAssetService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {Logger} from '@fluxer/api/src/Logger';
import type {Application} from '@fluxer/api/src/models/Application';
import type {User} from '@fluxer/api/src/models/User';
import {remapAuthorMessagesToDeletedUser} from '@fluxer/api/src/oauth/ApplicationMessageAuthorAnonymization';
import type {BotAuthService} from '@fluxer/api/src/oauth/BotAuthService';
import type {IApplicationRepository} from '@fluxer/api/src/oauth/repositories/IApplicationRepository';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {hasPartialUserFieldsChanged} from '@fluxer/api/src/user/UserMappers';
import {hashPassword} from '@fluxer/api/src/utils/PasswordUtils';
import {generateRandomUsername} from '@fluxer/api/src/utils/UsernameGenerator';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {DELETED_USER_GLOBAL_NAME, DELETED_USER_USERNAME, UserFlags} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {ForbiddenError} from '@fluxer/errors/src/domains/core/ForbiddenError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {InternalServerError} from '@fluxer/errors/src/domains/core/InternalServerError';
import {BotUserNotFoundError} from '@fluxer/errors/src/domains/oauth/BotUserNotFoundError';
import {UnclaimedAccountCannotCreateApplicationsError} from '@fluxer/errors/src/domains/oauth/UnclaimedAccountCannotCreateApplicationsError';
import {UnknownApplicationError} from '@fluxer/errors/src/domains/oauth/UnknownApplicationError';

export interface ApplicationServiceDeps {
	discriminatorService: DiscriminatorService;
	channelRepository: IChannelRepository;
	userRepository: IUserRepository;
	snowflakeService: SnowflakeService;
	applicationRepository: IApplicationRepository;
	botAuthService: BotAuthService;
	entityAssetService: EntityAssetService;
	userCacheService: UserCacheService;
	gatewayService: IGatewayService;
}

export class ApplicationNotOwnedError extends ForbiddenError {
	constructor() {
		super({code: APIErrorCodes.APPLICATION_NOT_OWNED});
		this.name = 'ApplicationNotOwnedError';
	}
}

class BotUserGenerationError extends InternalServerError {
	constructor() {
		super({code: APIErrorCodes.BOT_USER_GENERATION_FAILED});
		this.name = 'BotUserGenerationError';
	}
}

export class ApplicationService {
	constructor(public readonly deps: ApplicationServiceDeps) {}

	private sanitizeUsername(name: string): string {
		let sanitized = name
			.replace(/[\s\-.]+/g, '_')
			.replace(/[^a-zA-Z0-9_]/g, '')
			.substring(0, 32);

		if (sanitized.length < 2) {
			sanitized = `bot${sanitized}`;
		}

		return sanitized;
	}

	private async generateBotUsername(applicationName: string): Promise<{username: string; discriminator: number}> {
		const sanitized = this.sanitizeUsername(applicationName);

		const discResult = await this.deps.discriminatorService.generateDiscriminator({
			username: sanitized,
		});

		if (discResult.available && discResult.discriminator !== -1) {
			return {username: sanitized, discriminator: discResult.discriminator};
		}

		Logger.info(
			{applicationName, sanitizedName: sanitized},
			'Application name discriminators exhausted, falling back to random username',
		);

		for (let attempts = 0; attempts < 100; attempts++) {
			const randomUsername = generateRandomUsername();
			const randomDiscResult = await this.deps.discriminatorService.generateDiscriminator({
				username: randomUsername,
			});

			if (randomDiscResult.available && randomDiscResult.discriminator !== -1) {
				return {username: randomUsername, discriminator: randomDiscResult.discriminator};
			}
		}

		throw new BotUserGenerationError();
	}

	async createApplication(args: {
		ownerUserId: UserID;
		name: string;
		redirectUris?: Array<string>;
		botPublic?: boolean;
		botRequireCodeGrant?: boolean;
	}): Promise<{
		application: Application;
		botUser: User;
		botToken: string;
		clientSecret: string;
	}> {
		const initialRedirectUris = args.redirectUris ?? [];
		const owner = await this.deps.userRepository.findUniqueAssert(args.ownerUserId);
		const botIsPublic = args.botPublic ?? true;
		const botRequireCodeGrant = args.botRequireCodeGrant ?? false;

		if (owner.isUnclaimedAccount()) {
			throw new UnclaimedAccountCannotCreateApplicationsError();
		}

		const applicationId: ApplicationID = (await this.deps.snowflakeService.generate()) as ApplicationID;
		const botUserId = applicationIdToUserId(applicationId);

		const {username, discriminator} = await this.generateBotUsername(args.name);

		Logger.info(
			{
				applicationId: applicationId.toString(),
				botUserId: botUserId.toString(),
				username,
				discriminator,
				applicationName: args.name,
			},
			'Creating application with bot user',
		);

		const botUserRow: UserRow = {
			user_id: botUserId,
			username,
			discriminator,
			global_name: null,
			bot: true,
			system: false,
			email: null,
			email_verified: null,
			email_bounced: null,
			phone: null,
			password_hash: null,
			password_last_changed_at: null,
			totp_secret: null,
			authenticator_types: owner.authenticatorTypes ? new Set(owner.authenticatorTypes) : null,
			avatar_hash: null,
			avatar_color: null,
			banner_hash: null,
			banner_color: null,
			bio: null,
			pronouns: null,
			accent_color: null,
			date_of_birth: null,
			locale: null,
			flags: 0n,
			premium_type: null,
			premium_since: null,
			premium_until: null,
			premium_will_cancel: null,
			premium_billing_cycle: null,
			premium_lifetime_sequence: null,
			stripe_subscription_id: null,
			stripe_customer_id: null,
			has_ever_purchased: null,
			suspicious_activity_flags: null,
			terms_agreed_at: null,
			privacy_agreed_at: null,
			last_active_at: null,
			last_active_ip: null,
			temp_banned_until: null,
			pending_deletion_at: null,
			pending_bulk_message_deletion_at: null,
			pending_bulk_message_deletion_channel_count: null,
			pending_bulk_message_deletion_message_count: null,
			deletion_reason_code: null,
			deletion_public_reason: null,
			deletion_audit_log_reason: null,
			acls: null,
			traits: null,
			first_refund_at: null,
			gift_inventory_server_seq: null,
			gift_inventory_client_seq: null,
			premium_onboarding_dismissed_at: null,
			version: 1,
		};

		const botUser = await this.deps.userRepository.create(botUserRow);

		const {
			token: botToken,
			hash: botTokenHash,
			preview: botTokenPreview,
		} = await this.deps.botAuthService.generateBotToken(applicationId);
		const botTokenCreatedAt = new Date();
		const clientSecret = randomBytes(32).toString('base64url');
		const clientSecretHash = await hashPassword(clientSecret);
		const clientSecretCreatedAt = new Date();

		const applicationRow: ApplicationRow = {
			application_id: applicationId,
			owner_user_id: args.ownerUserId,
			name: args.name,
			bot_user_id: botUserId,
			bot_is_public: botIsPublic,
			bot_require_code_grant: botRequireCodeGrant,
			oauth2_redirect_uris: new Set<string>(initialRedirectUris),
			client_secret_hash: clientSecretHash,
			bot_token_hash: botTokenHash,
			bot_token_preview: botTokenPreview,
			bot_token_created_at: botTokenCreatedAt,
			client_secret_created_at: clientSecretCreatedAt,
		};

		const application = await this.deps.applicationRepository.upsertApplication(applicationRow);

		Logger.info(
			{applicationId: applicationId.toString(), botUserId: botUserId.toString()},
			'Successfully created application with bot user',
		);

		return {application, botUser, botToken, clientSecret};
	}

	async getApplication(applicationId: ApplicationID): Promise<Application | null> {
		return this.deps.applicationRepository.getApplication(applicationId);
	}

	async listApplicationsByOwner(ownerUserId: UserID): Promise<Array<Application>> {
		return this.deps.applicationRepository.listApplicationsByOwner(ownerUserId);
	}

	private async verifyOwnership(userId: UserID, applicationId: ApplicationID): Promise<Application> {
		const application = await this.deps.applicationRepository.getApplication(applicationId);
		if (!application) {
			throw new UnknownApplicationError();
		}

		if (application.ownerUserId !== userId) {
			throw new ApplicationNotOwnedError();
		}

		return application;
	}

	async updateApplication(args: {
		userId: UserID;
		applicationId: ApplicationID;
		name?: string;
		redirectUris?: Array<string>;
		botPublic?: boolean;
		botRequireCodeGrant?: boolean;
	}): Promise<Application> {
		const application = await this.verifyOwnership(args.userId, args.applicationId);

		const updatedRow: ApplicationRow = {
			...application.toRow(),
			name: args.name ?? application.name,
			oauth2_redirect_uris: args.redirectUris ? new Set(args.redirectUris) : application.oauth2RedirectUris,
			bot_is_public: args.botPublic ?? application.botIsPublic,
			bot_require_code_grant: args.botRequireCodeGrant ?? application.botRequireCodeGrant,
		};

		return this.deps.applicationRepository.upsertApplication(updatedRow);
	}

	async deleteApplication(userId: UserID, applicationId: ApplicationID): Promise<void> {
		const application = await this.verifyOwnership(userId, applicationId);

		if (application.hasBotUser()) {
			const botUserId = application.getBotUserId()!;
			const replacementAuthorId = await remapAuthorMessagesToDeletedUser({
				originalAuthorId: botUserId,
				channelRepository: this.deps.channelRepository,
				userRepository: this.deps.userRepository,
				snowflakeService: this.deps.snowflakeService,
			});
			const guildIds = await this.deps.userRepository.getUserGuildIds(botUserId);

			await this.deps.userRepository.deleteUserSecondaryIndices(botUserId);
			await this.deps.userRepository.removeFromAllGuilds(botUserId);

			for (const guildId of guildIds) {
				try {
					await this.deps.gatewayService.dispatchGuild({
						guildId,
						event: 'GUILD_MEMBER_REMOVE',
						data: {user: {id: botUserId.toString()}},
					});
					await this.deps.gatewayService.leaveGuild({userId: botUserId, guildId});
				} catch (error) {
					Logger.error(
						{
							error,
							applicationId: applicationId.toString(),
							botUserId: botUserId.toString(),
							guildId: guildId.toString(),
						},
						'Failed to dispatch guild removal for deleted bot',
					);
				}
			}

			const botUser = await this.deps.userRepository.findUniqueAssert(botUserId);
			await this.deps.userRepository.patchUpsert(
				botUserId,
				{
					username: DELETED_USER_USERNAME,
					global_name: DELETED_USER_GLOBAL_NAME,
					discriminator: 0,
					email: null,
					email_verified: false,
					phone: null,
					password_hash: null,
					password_last_changed_at: null,
					totp_secret: null,
					authenticator_types: new Set(),
					avatar_hash: null,
					banner_hash: null,
					bio: null,
					pronouns: null,
					accent_color: null,
					date_of_birth: null,
					flags: UserFlags.DELETED,
					premium_type: null,
					premium_since: null,
					premium_until: null,
					stripe_customer_id: null,
					stripe_subscription_id: null,
					pending_deletion_at: null,
					deletion_reason_code: null,
					deletion_public_reason: null,
					deletion_audit_log_reason: null,
				},
				botUser.toRow(),
			);

			await this.deps.userCacheService.invalidateUserCache(botUserId);
			if (replacementAuthorId) {
				await this.deps.userCacheService.invalidateUserCache(replacementAuthorId);
			}

			Logger.info(
				{
					applicationId: applicationId.toString(),
					botUserId: botUserId.toString(),
					replacementAuthorId: replacementAuthorId?.toString() ?? null,
				},
				'Anonymized bot user associated with application',
			);
		}

		await this.deps.applicationRepository.deleteApplication(applicationId);
		Logger.info({applicationId: applicationId.toString()}, 'Successfully deleted application');
	}

	async rotateBotToken(
		userId: UserID,
		applicationId: ApplicationID,
	): Promise<{
		token: string;
		preview: string;
	}> {
		const application = await this.verifyOwnership(userId, applicationId);

		if (!application.hasBotUser()) {
			throw new BotUserNotFoundError();
		}

		const {token, hash, preview} = await this.deps.botAuthService.generateBotToken(applicationId);
		const botTokenCreatedAt = new Date();

		const updatedRow: ApplicationRow = {
			...application.toRow(),
			bot_token_hash: hash,
			bot_token_preview: preview,
			bot_token_created_at: botTokenCreatedAt,
		};

		await this.deps.applicationRepository.upsertApplication(updatedRow);
		Logger.info({applicationId: applicationId.toString()}, 'Successfully rotated bot token');

		const botUserId = application.getBotUserId();
		if (botUserId !== null) {
			await this.deps.gatewayService.terminateAllSessionsForUser({
				userId: botUserId,
			});
		}

		return {token, preview};
	}

	async rotateClientSecret(
		userId: UserID,
		applicationId: ApplicationID,
	): Promise<{
		clientSecret: string;
	}> {
		const application = await this.verifyOwnership(userId, applicationId);

		const clientSecret = randomBytes(32).toString('base64url');
		const clientSecretHash = await hashPassword(clientSecret);
		const clientSecretCreatedAt = new Date();

		const updatedRow: ApplicationRow = {
			...application.toRow(),
			client_secret_hash: clientSecretHash,
			client_secret_created_at: clientSecretCreatedAt,
		};

		await this.deps.applicationRepository.upsertApplication(updatedRow);
		Logger.info({applicationId: applicationId.toString()}, 'Successfully rotated client secret');

		return {clientSecret};
	}

	async updateBotProfile(
		userId: UserID,
		applicationId: ApplicationID,
		args: {
			username?: string;
			discriminator?: number;
			avatar?: string | null;
			banner?: string | null;
			bio?: string | null;
			botFlags?: number;
		},
	): Promise<{
		user: User;
		application: Application;
	}> {
		const application = await this.verifyOwnership(userId, applicationId);

		if (!application.hasBotUser()) {
			throw new BotUserNotFoundError();
		}

		const botUserId = application.getBotUserId()!;
		const botUser = await this.deps.userRepository.findUnique(botUserId);
		if (!botUser) {
			throw new BotUserNotFoundError();
		}

		if (args.discriminator !== undefined && args.discriminator !== botUser.discriminator) {
			throw InputValidationError.fromCode('discriminator', ValidationErrorCodes.BOT_DISCRIMINATOR_CANNOT_BE_CHANGED);
		}

		const updates: Partial<UserRow> = {};

		const newUsername = args.username ?? botUser.username;
		const usernameChanged = args.username !== undefined && args.username !== botUser.username;

		if (usernameChanged) {
			const result = await this.deps.discriminatorService.resolveUsernameChange({
				currentUsername: botUser.username,
				currentDiscriminator: botUser.discriminator,
				newUsername,
			});

			if (result.username !== botUser.username) {
				updates.username = result.username;
			}
			if (result.discriminator !== botUser.discriminator) {
				updates.discriminator = result.discriminator;
			}
		}

		updates.global_name = null;

		const assetPrep = await this.prepareBotAssets({
			botUser,
			botUserId,
			avatar: args.avatar,
			banner: args.banner,
		});
		if (assetPrep.avatarHash !== undefined) {
			updates.avatar_hash = assetPrep.avatarHash;
		}
		if (assetPrep.bannerHash !== undefined) {
			updates.banner_hash = assetPrep.bannerHash;
		}

		if (args.bio !== undefined) {
			updates.bio = args.bio;
		}

		if (args.botFlags !== undefined) {
			const friendlyFlag = UserFlags.FRIENDLY_BOT;
			const manualApprovalFlag = UserFlags.FRIENDLY_BOT_MANUAL_APPROVAL;
			const desiredFriendly = (BigInt(args.botFlags) & friendlyFlag) === friendlyFlag;
			const desiredManualApproval = (BigInt(args.botFlags) & manualApprovalFlag) === manualApprovalFlag;
			const currentlyFriendly = (botUser.flags & friendlyFlag) === friendlyFlag;
			const currentlyManualApproval = (botUser.flags & manualApprovalFlag) === manualApprovalFlag;
			let updatedFlags = botUser.flags;

			if (desiredFriendly && !currentlyFriendly) {
				updatedFlags |= friendlyFlag;
			} else if (!desiredFriendly && currentlyFriendly) {
				updatedFlags &= ~friendlyFlag;
			}

			if (desiredManualApproval && !currentlyManualApproval) {
				updatedFlags |= manualApprovalFlag;
			} else if (!desiredManualApproval && currentlyManualApproval) {
				updatedFlags &= ~manualApprovalFlag;
			}

			if (updatedFlags !== botUser.flags) {
				updates.flags = updatedFlags;
			}
		}

		let updatedUser: User | null;
		try {
			updatedUser = await this.deps.userRepository.patchUpsert(botUserId, updates, botUser.toRow());
		} catch (err) {
			await this.rollbackBotAssets(assetPrep);
			throw err;
		}
		if (!updatedUser) {
			await this.rollbackBotAssets(assetPrep);
			throw new BotUserNotFoundError();
		}

		try {
			await this.commitBotAssets(assetPrep);
		} catch (err) {
			await this.rollbackBotAssets(assetPrep);
			throw err;
		}

		if (hasPartialUserFieldsChanged(botUser, updatedUser)) {
			await this.deps.userCacheService.setUserPartialResponseFromUser(updatedUser);
		}

		Logger.info(
			{applicationId: applicationId.toString(), botUserId: botUserId.toString()},
			'Successfully updated bot profile',
		);

		return {
			user: updatedUser,
			application,
		};
	}

	private async prepareBotAssets(params: {
		botUser: User;
		botUserId: UserID;
		avatar?: string | null;
		banner?: string | null;
	}): Promise<{
		avatarUpload: PreparedAssetUpload | null;
		bannerUpload: PreparedAssetUpload | null;
		avatarHash: string | null | undefined;
		bannerHash: string | null | undefined;
	}> {
		const {botUser, botUserId, avatar, banner} = params;

		let avatarUpload: PreparedAssetUpload | null = null;
		let bannerUpload: PreparedAssetUpload | null = null;
		let avatarHash: string | null | undefined;
		let bannerHash: string | null | undefined;

		if (avatar !== undefined) {
			avatarUpload = await this.deps.entityAssetService.prepareAssetUpload({
				assetType: 'avatar',
				entityType: 'user',
				entityId: botUserId,
				previousHash: botUser.avatarHash,
				base64Image: avatar,
				errorPath: 'avatar',
			});
			avatarHash = avatarUpload.newHash;
			if (avatarUpload.newHash === botUser.avatarHash) {
				avatarUpload = null;
			}
		}

		if (banner !== undefined) {
			bannerUpload = await this.deps.entityAssetService.prepareAssetUpload({
				assetType: 'banner',
				entityType: 'user',
				entityId: botUserId,
				previousHash: botUser.bannerHash,
				base64Image: banner,
				errorPath: 'banner',
			});
			bannerHash = bannerUpload.newHash;
			if (bannerUpload.newHash === botUser.bannerHash) {
				bannerUpload = null;
			}
		}

		return {avatarUpload, bannerUpload, avatarHash, bannerHash};
	}

	private async commitBotAssets(assetPrep: {
		avatarUpload: PreparedAssetUpload | null;
		bannerUpload: PreparedAssetUpload | null;
	}) {
		if (assetPrep.avatarUpload) {
			await this.deps.entityAssetService.commitAssetChange({prepared: assetPrep.avatarUpload, deferDeletion: true});
		}
		if (assetPrep.bannerUpload) {
			await this.deps.entityAssetService.commitAssetChange({prepared: assetPrep.bannerUpload, deferDeletion: true});
		}
	}

	private async rollbackBotAssets(assetPrep: {
		avatarUpload: PreparedAssetUpload | null;
		bannerUpload: PreparedAssetUpload | null;
	}) {
		if (assetPrep.avatarUpload) {
			await this.deps.entityAssetService.rollbackAssetUpload(assetPrep.avatarUpload);
		}
		if (assetPrep.bannerUpload) {
			await this.deps.entityAssetService.rollbackAssetUpload(assetPrep.bannerUpload);
		}
	}
}
