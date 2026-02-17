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

import type {AuthService} from '@fluxer/api/src/auth/AuthService';
import type {SudoVerificationResult} from '@fluxer/api/src/auth/services/SudoVerificationService';
import type {GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {IConnectionRepository} from '@fluxer/api/src/connection/IConnectionRepository';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {GuildService} from '@fluxer/api/src/guild/services/GuildService';
import {GuildMemberSearchIndexService} from '@fluxer/api/src/guild/services/member/GuildMemberSearchIndexService';
import type {IDiscriminatorService} from '@fluxer/api/src/infrastructure/DiscriminatorService';
import type {EntityAssetService} from '@fluxer/api/src/infrastructure/EntityAssetService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {KVAccountDeletionQueueService} from '@fluxer/api/src/infrastructure/KVAccountDeletionQueueService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {Logger} from '@fluxer/api/src/Logger';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {AuthSession} from '@fluxer/api/src/models/AuthSession';
import type {User} from '@fluxer/api/src/models/User';
import type {UserGuildSettings} from '@fluxer/api/src/models/UserGuildSettings';
import type {UserSettings} from '@fluxer/api/src/models/UserSettings';
import type {PackService} from '@fluxer/api/src/pack/PackService';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import type {IUserChannelRepository} from '@fluxer/api/src/user/repositories/IUserChannelRepository';
import type {IUserRelationshipRepository} from '@fluxer/api/src/user/repositories/IUserRelationshipRepository';
import type {IUserSettingsRepository} from '@fluxer/api/src/user/repositories/IUserSettingsRepository';
import {UserAccountLifecycleService} from '@fluxer/api/src/user/services/UserAccountLifecycleService';
import {UserAccountLookupService} from '@fluxer/api/src/user/services/UserAccountLookupService';
import {UserAccountNotesService} from '@fluxer/api/src/user/services/UserAccountNotesService';
import {UserAccountProfileService} from '@fluxer/api/src/user/services/UserAccountProfileService';
import {UserAccountSecurityService} from '@fluxer/api/src/user/services/UserAccountSecurityService';
import {UserAccountSettingsService} from '@fluxer/api/src/user/services/UserAccountSettingsService';
import {UserAccountUpdatePropagator} from '@fluxer/api/src/user/services/UserAccountUpdatePropagator';
import type {UserContactChangeLogService} from '@fluxer/api/src/user/services/UserContactChangeLogService';
import {createPremiumClearPatch} from '@fluxer/api/src/user/UserHelpers';
import {hasPartialUserFieldsChanged} from '@fluxer/api/src/user/UserMappers';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import type {IEmailService} from '@fluxer/email/src/IEmailService';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {
	UserGuildSettingsUpdateRequest,
	UserSettingsUpdateRequest,
	UserUpdateRequest,
} from '@fluxer/schema/src/domains/user/UserRequestSchemas';

interface UpdateUserParams {
	user: User;
	oldAuthSession: AuthSession;
	data: UserUpdateRequest;
	request: Request;
	sudoContext?: SudoVerificationResult;
	emailVerifiedViaToken?: boolean;
}

export class UserAccountService {
	private readonly lookupService: UserAccountLookupService;
	private readonly profileService: UserAccountProfileService;
	private readonly securityService: UserAccountSecurityService;
	private readonly settingsService: UserAccountSettingsService;
	private readonly notesService: UserAccountNotesService;
	private readonly lifecycleService: UserAccountLifecycleService;
	private readonly updatePropagator: UserAccountUpdatePropagator;
	private readonly guildRepository: IGuildRepositoryAggregate;
	private readonly searchIndexService: GuildMemberSearchIndexService;

	constructor(
		private readonly userAccountRepository: IUserAccountRepository,
		userSettingsRepository: IUserSettingsRepository,
		userRelationshipRepository: IUserRelationshipRepository,
		userChannelRepository: IUserChannelRepository,
		authService: AuthService,
		userCacheService: UserCacheService,
		guildService: GuildService,
		gatewayService: IGatewayService,
		entityAssetService: EntityAssetService,
		mediaService: IMediaService,
		packService: PackService,
		emailService: IEmailService,
		rateLimitService: IRateLimitService,
		guildRepository: IGuildRepositoryAggregate,
		discriminatorService: IDiscriminatorService,
		kvDeletionQueue: KVAccountDeletionQueueService,
		private readonly contactChangeLogService: UserContactChangeLogService,
		connectionRepository: IConnectionRepository,
		readonly limitConfigService: LimitConfigService,
	) {
		this.guildRepository = guildRepository;
		this.searchIndexService = new GuildMemberSearchIndexService();

		this.updatePropagator = new UserAccountUpdatePropagator({
			userCacheService,
			gatewayService,
			mediaService,
			userRepository: userAccountRepository,
		});

		this.lookupService = new UserAccountLookupService({
			userAccountRepository,
			userRelationshipRepository,
			userChannelRepository,
			guildRepository,
			guildService,
			discriminatorService,
			connectionRepository,
		});

		this.profileService = new UserAccountProfileService({
			userAccountRepository,
			guildRepository,
			entityAssetService,
			rateLimitService,
			updatePropagator: this.updatePropagator,
			limitConfigService,
		});

		this.securityService = new UserAccountSecurityService({
			userAccountRepository,
			authService,
			discriminatorService,
			rateLimitService,
			limitConfigService,
		});

		this.settingsService = new UserAccountSettingsService({
			userAccountRepository,
			userSettingsRepository,
			updatePropagator: this.updatePropagator,
			guildRepository,
			packService,
			limitConfigService,
		});

		this.notesService = new UserAccountNotesService({
			userAccountRepository,
			userRelationshipRepository,
			updatePropagator: this.updatePropagator,
		});

		this.lifecycleService = new UserAccountLifecycleService({
			userAccountRepository,
			guildRepository,
			authService,
			emailService,
			updatePropagator: this.updatePropagator,
			kvDeletionQueue,
		});
	}

	async findUnique(userId: UserID): Promise<User | null> {
		return this.lookupService.findUnique(userId);
	}

	async findUniqueAssert(userId: UserID): Promise<User> {
		return this.lookupService.findUniqueAssert(userId);
	}

	async getUserProfile(params: {
		userId: UserID;
		targetId: UserID;
		guildId?: GuildID;
		withMutualFriends?: boolean;
		withMutualGuilds?: boolean;
		requestCache: RequestCache;
	}) {
		return this.lookupService.getUserProfile(params);
	}

	async generateUniqueDiscriminator(username: string): Promise<number> {
		return this.lookupService.generateUniqueDiscriminator(username);
	}

	async checkUsernameDiscriminatorAvailability(params: {username: string; discriminator: number}): Promise<boolean> {
		return this.lookupService.checkUsernameDiscriminatorAvailability(params);
	}

	async update(params: UpdateUserParams): Promise<User> {
		const {user, oldAuthSession, data, request, sudoContext, emailVerifiedViaToken = false} = params;

		const profileResult = await this.profileService.processProfileUpdates({user, data});
		const securityResult = await this.securityService.processSecurityUpdates({user, data, sudoContext});

		const updates = {
			...securityResult.updates,
			...profileResult.updates,
		};
		const metadata = {
			...securityResult.metadata,
			...profileResult.metadata,
		};

		const emailChanged = data.email !== undefined;
		if (emailChanged) {
			updates.email_verified = !!emailVerifiedViaToken;
		}

		let updatedUser: User;
		try {
			updatedUser = await this.userAccountRepository.patchUpsert(user.id, updates, user.toRow());
		} catch (error) {
			await this.profileService.rollbackAssetChanges(profileResult);
			Logger.error({error, userId: user.id}, 'User update failed, rolled back asset uploads');
			throw error;
		}

		await this.contactChangeLogService.recordDiff({
			oldUser: user,
			newUser: updatedUser,
			reason: 'user_requested',
			actorUserId: user.id,
		});

		await this.profileService.commitAssetChanges(profileResult).catch((error) => {
			Logger.error({error, userId: user.id}, 'Failed to commit asset changes after successful DB update');
		});

		await this.updatePropagator.dispatchUserUpdate(updatedUser);

		if (hasPartialUserFieldsChanged(user, updatedUser)) {
			await this.updatePropagator.updateUserCache(updatedUser);
		}

		const nameChanged =
			user.username !== updatedUser.username ||
			user.discriminator !== updatedUser.discriminator ||
			user.globalName !== updatedUser.globalName;
		if (nameChanged) {
			void this.reindexGuildMembersForUser(updatedUser);
		}

		if (metadata.invalidateAuthSessions) {
			await this.securityService.invalidateAndRecreateSessions({user, oldAuthSession, request});
		}

		return updatedUser;
	}

	private async reindexGuildMembersForUser(updatedUser: User): Promise<void> {
		try {
			const guildIds = await this.userAccountRepository.getUserGuildIds(updatedUser.id);
			for (const guildId of guildIds) {
				const guild = await this.guildRepository.findUnique(guildId);
				if (!guild?.membersIndexedAt) {
					continue;
				}
				const member = await this.guildRepository.getMember(guildId, updatedUser.id);
				if (member) {
					void this.searchIndexService.updateMember(member, updatedUser);
				}
			}
		} catch (error) {
			Logger.error({userId: updatedUser.id.toString(), error}, 'Failed to reindex guild members after user update');
		}
	}

	async findSettings(userId: UserID): Promise<UserSettings> {
		return this.settingsService.findSettings(userId);
	}

	async updateSettings(params: {userId: UserID; data: UserSettingsUpdateRequest}): Promise<UserSettings> {
		return this.settingsService.updateSettings(params);
	}

	async findGuildSettings(userId: UserID, guildId: GuildID | null): Promise<UserGuildSettings | null> {
		return this.settingsService.findGuildSettings(userId, guildId);
	}

	async updateGuildSettings(params: {
		userId: UserID;
		guildId: GuildID | null;
		data: UserGuildSettingsUpdateRequest;
	}): Promise<UserGuildSettings> {
		return this.settingsService.updateGuildSettings(params);
	}

	async getUserNote(params: {userId: UserID; targetId: UserID}): Promise<{note: string} | null> {
		return this.notesService.getUserNote(params);
	}

	async getUserNotes(userId: UserID): Promise<Record<string, string>> {
		return this.notesService.getUserNotes(userId);
	}

	async setUserNote(params: {userId: UserID; targetId: UserID; note: string | null}): Promise<void> {
		return this.notesService.setUserNote(params);
	}

	async selfDisable(userId: UserID): Promise<void> {
		return this.lifecycleService.selfDisable(userId);
	}

	async selfDelete(userId: UserID): Promise<void> {
		return this.lifecycleService.selfDelete(userId);
	}

	async resetCurrentUserPremiumState(user: User): Promise<void> {
		const updates = {
			...createPremiumClearPatch(),
			premium_lifetime_sequence: null,
			stripe_subscription_id: null,
			stripe_customer_id: null,
			has_ever_purchased: null,
			first_refund_at: null,
			gift_inventory_server_seq: null,
			gift_inventory_client_seq: null,
			flags: user.flags & ~UserFlags.PREMIUM_ENABLED_OVERRIDE,
		};
		const updatedUser = await this.userAccountRepository.patchUpsert(user.id, updates, user.toRow());
		await this.updatePropagator.dispatchUserUpdate(updatedUser);
		if (hasPartialUserFieldsChanged(user, updatedUser)) {
			await this.updatePropagator.updateUserCache(updatedUser);
		}
	}

	async dispatchUserUpdate(user: User): Promise<void> {
		return this.updatePropagator.dispatchUserUpdate(user);
	}

	async dispatchUserSettingsUpdate({userId, settings}: {userId: UserID; settings: UserSettings}): Promise<void> {
		return this.updatePropagator.dispatchUserSettingsUpdate({userId, settings});
	}

	async dispatchUserGuildSettingsUpdate({
		userId,
		settings,
	}: {
		userId: UserID;
		settings: UserGuildSettings;
	}): Promise<void> {
		return this.updatePropagator.dispatchUserGuildSettingsUpdate({userId, settings});
	}

	async dispatchUserNoteUpdate(params: {userId: UserID; targetId: UserID; note: string}): Promise<void> {
		return this.updatePropagator.dispatchUserNoteUpdate(params);
	}
}
