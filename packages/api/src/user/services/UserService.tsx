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
import type {ChannelID, GuildID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {IConnectionRepository} from '@fluxer/api/src/connection/IConnectionRepository';
import type {UserConnectionRow} from '@fluxer/api/src/database/types/ConnectionTypes';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {GuildService} from '@fluxer/api/src/guild/services/GuildService';
import type {IDiscriminatorService} from '@fluxer/api/src/infrastructure/DiscriminatorService';
import type {EntityAssetService} from '@fluxer/api/src/infrastructure/EntityAssetService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {KVAccountDeletionQueueService} from '@fluxer/api/src/infrastructure/KVAccountDeletionQueueService';
import type {KVBulkMessageDeletionQueueService} from '@fluxer/api/src/infrastructure/KVBulkMessageDeletionQueueService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {AuthSession} from '@fluxer/api/src/models/AuthSession';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {Message} from '@fluxer/api/src/models/Message';
import type {MfaBackupCode} from '@fluxer/api/src/models/MfaBackupCode';
import type {PushSubscription} from '@fluxer/api/src/models/PushSubscription';
import type {Relationship} from '@fluxer/api/src/models/Relationship';
import type {User} from '@fluxer/api/src/models/User';
import type {UserGuildSettings} from '@fluxer/api/src/models/UserGuildSettings';
import type {UserSettings} from '@fluxer/api/src/models/UserSettings';
import type {BotMfaMirrorService} from '@fluxer/api/src/oauth/BotMfaMirrorService';
import type {PackService} from '@fluxer/api/src/pack/PackService';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import type {IUserAuthRepository} from '@fluxer/api/src/user/repositories/IUserAuthRepository';
import type {IUserChannelRepository} from '@fluxer/api/src/user/repositories/IUserChannelRepository';
import type {IUserContentRepository} from '@fluxer/api/src/user/repositories/IUserContentRepository';
import type {IUserRelationshipRepository} from '@fluxer/api/src/user/repositories/IUserRelationshipRepository';
import type {IUserSettingsRepository} from '@fluxer/api/src/user/repositories/IUserSettingsRepository';
import {UserAccountService} from '@fluxer/api/src/user/services/UserAccountService';
import {UserAuthService} from '@fluxer/api/src/user/services/UserAuthService';
import {UserChannelService} from '@fluxer/api/src/user/services/UserChannelService';
import type {UserContactChangeLogService} from '@fluxer/api/src/user/services/UserContactChangeLogService';
import type {SavedMessageEntry} from '@fluxer/api/src/user/services/UserContentService';
import {UserContentService} from '@fluxer/api/src/user/services/UserContentService';
import {UserRelationshipService} from '@fluxer/api/src/user/services/UserRelationshipService';
import type {UserHarvestResponse} from '@fluxer/api/src/user/UserHarvestModel';
import type {UserPermissionUtils} from '@fluxer/api/src/utils/UserPermissionUtils';
import type {IEmailService} from '@fluxer/email/src/IEmailService';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {GuildMemberResponse} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {
	CreatePrivateChannelRequest,
	FriendRequestByTagRequest,
	UserGuildSettingsUpdateRequest,
	UserSettingsUpdateRequest,
	UserUpdateRequest,
} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';

interface UpdateUserParams {
	user: User;
	oldAuthSession: AuthSession;
	data: UserUpdateRequest;
	request: Request;
	sudoContext?: SudoVerificationResult;
	emailVerifiedViaToken?: boolean;
}

export class UserService {
	private accountService: UserAccountService;
	private authService: UserAuthService;
	private relationshipService: UserRelationshipService;
	private channelService: UserChannelService;
	private contentService: UserContentService;

	constructor(
		userAccountRepository: IUserAccountRepository,
		userSettingsRepository: IUserSettingsRepository,
		userAuthRepository: IUserAuthRepository,
		userRelationshipRepository: IUserRelationshipRepository,
		userChannelRepository: IUserChannelRepository,
		userContentRepository: IUserContentRepository,
		authService: AuthService,
		userCacheService: UserCacheService,
		channelService: ChannelService,
		channelRepository: IChannelRepository,
		guildService: GuildService,
		gatewayService: IGatewayService,
		entityAssetService: EntityAssetService,
		mediaService: IMediaService,
		packService: PackService,
		emailService: IEmailService,
		snowflakeService: SnowflakeService,
		discriminatorService: IDiscriminatorService,
		rateLimitService: IRateLimitService,
		guildRepository: IGuildRepositoryAggregate,
		workerService: IWorkerService,
		userPermissionUtils: UserPermissionUtils,
		kvDeletionQueue: KVAccountDeletionQueueService,
		bulkMessageDeletionQueue: KVBulkMessageDeletionQueueService,
		botMfaMirrorService: BotMfaMirrorService,
		contactChangeLogService: UserContactChangeLogService,
		connectionRepository: IConnectionRepository,
		limitConfigService: LimitConfigService,
	) {
		this.accountService = new UserAccountService(
			userAccountRepository,
			userSettingsRepository,
			userRelationshipRepository,
			userChannelRepository,
			authService,
			userCacheService,
			guildService,
			gatewayService,
			entityAssetService,
			mediaService,
			packService,
			emailService,
			rateLimitService,
			guildRepository,
			discriminatorService,
			kvDeletionQueue,
			contactChangeLogService,
			connectionRepository,
			limitConfigService,
		);

		this.authService = new UserAuthService(
			userAccountRepository,
			userAuthRepository,
			authService,
			emailService,
			gatewayService,
			botMfaMirrorService,
		);

		this.relationshipService = new UserRelationshipService(
			userAccountRepository,
			userRelationshipRepository,
			gatewayService,
			userPermissionUtils,
			limitConfigService,
		);

		this.channelService = new UserChannelService(
			userAccountRepository,
			userChannelRepository,
			userRelationshipRepository,
			channelService,
			channelRepository,
			gatewayService,
			mediaService,
			snowflakeService,
			userPermissionUtils,
			limitConfigService,
		);

		this.contentService = new UserContentService(
			userAccountRepository,
			userContentRepository,
			userCacheService,
			channelService,
			channelRepository,
			gatewayService,
			mediaService,
			workerService,
			snowflakeService,
			bulkMessageDeletionQueue,
			limitConfigService,
		);
	}

	async findUnique(userId: UserID): Promise<User | null> {
		return await this.accountService.findUnique(userId);
	}

	async findUniqueAssert(userId: UserID): Promise<User> {
		return await this.accountService.findUniqueAssert(userId);
	}

	async getUserProfile(params: {
		userId: UserID;
		targetId: UserID;
		guildId?: GuildID;
		withMutualFriends?: boolean;
		withMutualGuilds?: boolean;
		requestCache: RequestCache;
	}): Promise<{
		user: User;
		guildMember?: GuildMemberResponse | null;
		guildMemberDomain?: GuildMember | null;
		premiumType?: number;
		premiumSince?: Date;
		premiumLifetimeSequence?: number;
		mutualFriends?: Array<User>;
		mutualGuilds?: Array<{id: string; nick: string | null}>;
		connections?: Array<UserConnectionRow>;
	}> {
		return await this.accountService.getUserProfile(params);
	}

	async update(params: UpdateUserParams): Promise<User> {
		return await this.accountService.update(params);
	}

	async generateUniqueDiscriminator(username: string): Promise<number> {
		return await this.accountService.generateUniqueDiscriminator(username);
	}

	async checkUsernameDiscriminatorAvailability(params: {username: string; discriminator: number}): Promise<boolean> {
		return await this.accountService.checkUsernameDiscriminatorAvailability(params);
	}

	async findSettings(userId: UserID): Promise<UserSettings> {
		return await this.accountService.findSettings(userId);
	}

	async updateSettings(params: {userId: UserID; data: UserSettingsUpdateRequest}): Promise<UserSettings> {
		return await this.accountService.updateSettings(params);
	}

	async findGuildSettings(userId: UserID, guildId: GuildID | null): Promise<UserGuildSettings | null> {
		return await this.accountService.findGuildSettings(userId, guildId);
	}

	async updateGuildSettings(params: {
		userId: UserID;
		guildId: GuildID | null;
		data: UserGuildSettingsUpdateRequest;
	}): Promise<UserGuildSettings> {
		return await this.accountService.updateGuildSettings(params);
	}

	async getUserNote(params: {userId: UserID; targetId: UserID}): Promise<{note: string} | null> {
		return await this.accountService.getUserNote(params);
	}

	async getUserNotes(userId: UserID): Promise<Record<string, string>> {
		return await this.accountService.getUserNotes(userId);
	}

	async setUserNote(params: {userId: UserID; targetId: UserID; note: string | null}): Promise<void> {
		return await this.accountService.setUserNote(params);
	}

	async selfDisable(userId: UserID): Promise<void> {
		return await this.accountService.selfDisable(userId);
	}

	async selfDelete(userId: UserID): Promise<void> {
		return await this.accountService.selfDelete(userId);
	}

	async resetCurrentUserPremiumState(user: User): Promise<void> {
		return await this.accountService.resetCurrentUserPremiumState(user);
	}

	async dispatchUserUpdate(user: User): Promise<void> {
		return await this.accountService.dispatchUserUpdate(user);
	}

	async dispatchUserSettingsUpdate({userId, settings}: {userId: UserID; settings: UserSettings}): Promise<void> {
		return await this.accountService.dispatchUserSettingsUpdate({userId, settings});
	}

	async dispatchUserGuildSettingsUpdate({
		userId,
		settings,
	}: {
		userId: UserID;
		settings: UserGuildSettings;
	}): Promise<void> {
		return await this.accountService.dispatchUserGuildSettingsUpdate({userId, settings});
	}

	async dispatchUserNoteUpdate(params: {userId: UserID; targetId: UserID; note: string}): Promise<void> {
		return await this.accountService.dispatchUserNoteUpdate(params);
	}

	async enableMfaTotp(params: {
		user: User;
		secret: string;
		code: string;
		sudoContext: SudoVerificationResult;
	}): Promise<Array<MfaBackupCode>> {
		return await this.authService.enableMfaTotp(params);
	}

	async disableMfaTotp(params: {
		user: User;
		code: string;
		sudoContext: SudoVerificationResult;
		password?: string;
	}): Promise<void> {
		return await this.authService.disableMfaTotp(params);
	}

	async getMfaBackupCodes(params: {
		user: User;
		regenerate: boolean;
		sudoContext: SudoVerificationResult;
		password?: string;
	}): Promise<Array<MfaBackupCode>> {
		return await this.authService.getMfaBackupCodes(params);
	}

	async regenerateMfaBackupCodes(user: User): Promise<Array<MfaBackupCode>> {
		return await this.authService.regenerateMfaBackupCodes(user);
	}

	async verifyEmail(token: string): Promise<boolean> {
		return await this.authService.verifyEmail(token);
	}

	async resendVerificationEmail(user: User): Promise<boolean> {
		return await this.authService.resendVerificationEmail(user);
	}

	async getRelationships(userId: UserID): Promise<Array<Relationship>> {
		return await this.relationshipService.getRelationships(userId);
	}

	async sendFriendRequestByTag({
		userId,
		data,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		data: FriendRequestByTagRequest;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		return await this.relationshipService.sendFriendRequestByTag({userId, data, userCacheService, requestCache});
	}

	async sendFriendRequest({
		userId,
		targetId,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		return await this.relationshipService.sendFriendRequest({userId, targetId, userCacheService, requestCache});
	}

	async acceptFriendRequest({
		userId,
		targetId,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		const relationship = await this.relationshipService.acceptFriendRequest({
			userId,
			targetId,
			userCacheService,
			requestCache,
		});

		await this.channelService.ensureDmOpenForBothUsers({
			userId,
			recipientId: targetId,
			userCacheService,
			requestCache,
		});

		return relationship;
	}

	async blockUser({
		userId,
		targetId,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		return await this.relationshipService.blockUser({userId, targetId, userCacheService, requestCache});
	}

	async updateFriendNickname({
		userId,
		targetId,
		nickname,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		targetId: UserID;
		nickname: string | null;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Relationship> {
		return await this.relationshipService.updateFriendNickname({
			userId,
			targetId,
			nickname,
			userCacheService,
			requestCache,
		});
	}

	async removeRelationship({userId, targetId}: {userId: UserID; targetId: UserID}): Promise<void> {
		return await this.relationshipService.removeRelationship({userId, targetId});
	}

	async dispatchRelationshipCreate({
		userId,
		relationship,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		relationship: Relationship;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<void> {
		return await this.relationshipService.dispatchRelationshipCreate({
			userId,
			relationship,
			userCacheService,
			requestCache,
		});
	}

	async dispatchRelationshipUpdate({
		userId,
		relationship,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		relationship: Relationship;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<void> {
		return await this.relationshipService.dispatchRelationshipUpdate({
			userId,
			relationship,
			userCacheService,
			requestCache,
		});
	}

	async dispatchRelationshipRemove({userId, targetId}: {userId: UserID; targetId: string}): Promise<void> {
		return await this.relationshipService.dispatchRelationshipRemove({userId, targetId});
	}

	async getPrivateChannels(userId: UserID): Promise<Array<Channel>> {
		return await this.channelService.getPrivateChannels(userId);
	}

	async createOrOpenDMChannel({
		userId,
		data,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		data: CreatePrivateChannelRequest;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<Channel> {
		return await this.channelService.createOrOpenDMChannel({userId, data, userCacheService, requestCache});
	}

	async pinDmChannel({userId, channelId}: {userId: UserID; channelId: ChannelID}): Promise<void> {
		return await this.channelService.pinDmChannel({userId, channelId});
	}

	async unpinDmChannel({userId, channelId}: {userId: UserID; channelId: ChannelID}): Promise<void> {
		return await this.channelService.unpinDmChannel({userId, channelId});
	}

	async preloadDMMessages(params: {
		userId: UserID;
		channelIds: Array<ChannelID>;
	}): Promise<Record<string, Message | null>> {
		return await this.channelService.preloadDMMessages(params);
	}

	async getRecentMentions(params: {
		userId: UserID;
		limit: number;
		everyone: boolean;
		roles: boolean;
		guilds: boolean;
		before?: MessageID;
	}): Promise<Array<Message>> {
		return await this.contentService.getRecentMentions(params);
	}

	async deleteRecentMention({userId, messageId}: {userId: UserID; messageId: MessageID}): Promise<void> {
		return await this.contentService.deleteRecentMention({userId, messageId});
	}

	async getSavedMessages({userId, limit}: {userId: UserID; limit: number}): Promise<Array<SavedMessageEntry>> {
		return await this.contentService.getSavedMessages({userId, limit});
	}

	async saveMessage({
		userId,
		channelId,
		messageId,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<void> {
		return await this.contentService.saveMessage({userId, channelId, messageId, userCacheService, requestCache});
	}

	async unsaveMessage({userId, messageId}: {userId: UserID; messageId: MessageID}): Promise<void> {
		return await this.contentService.unsaveMessage({userId, messageId});
	}

	async registerPushSubscription(params: {
		userId: UserID;
		endpoint: string;
		keys: {p256dh: string; auth: string};
		userAgent?: string;
	}): Promise<PushSubscription> {
		return await this.contentService.registerPushSubscription(params);
	}

	async listPushSubscriptions(userId: UserID): Promise<Array<PushSubscription>> {
		return await this.contentService.listPushSubscriptions(userId);
	}

	async deletePushSubscription(userId: UserID, subscriptionId: string): Promise<void> {
		return await this.contentService.deletePushSubscription(userId, subscriptionId);
	}

	async requestDataHarvest(userId: UserID): Promise<{
		harvest_id: string;
		status: 'pending' | 'processing' | 'completed' | 'failed';
		created_at: string;
	}> {
		return await this.contentService.requestDataHarvest(userId);
	}

	async getHarvestStatus(userId: UserID, harvestId: bigint): Promise<UserHarvestResponse> {
		return await this.contentService.getHarvestStatus(userId, harvestId);
	}

	async getLatestHarvest(userId: UserID): Promise<UserHarvestResponse | null> {
		return await this.contentService.getLatestHarvest(userId);
	}

	async getHarvestDownloadUrl(
		userId: UserID,
		harvestId: bigint,
		storageService: IStorageService,
	): Promise<{download_url: string; expires_at: string}> {
		return await this.contentService.getHarvestDownloadUrl(userId, harvestId, storageService);
	}

	async requestBulkMessageDeletion(params: {userId: UserID; delayMs?: number}): Promise<void> {
		return await this.contentService.requestBulkMessageDeletion(params);
	}

	async cancelBulkMessageDeletion(userId: UserID): Promise<void> {
		return await this.contentService.cancelBulkMessageDeletion(userId);
	}

	async dispatchRecentMentionDelete({userId, messageId}: {userId: UserID; messageId: MessageID}): Promise<void> {
		return await this.contentService.dispatchRecentMentionDelete({userId, messageId});
	}

	async dispatchSavedMessageCreate({
		userId,
		message,
		userCacheService,
		requestCache,
	}: {
		userId: UserID;
		message: Message;
		userCacheService: UserCacheService;
		requestCache: RequestCache;
	}): Promise<void> {
		return await this.contentService.dispatchSavedMessageCreate({userId, message, userCacheService, requestCache});
	}

	async dispatchSavedMessageDelete({userId, messageId}: {userId: UserID; messageId: MessageID}): Promise<void> {
		return await this.contentService.dispatchSavedMessageDelete({userId, messageId});
	}
}
