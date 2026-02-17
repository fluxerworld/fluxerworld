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

import type {ChannelID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {MessageRequest} from '@fluxer/api/src/channel/MessageTypes';
import {AttachmentUploadService} from '@fluxer/api/src/channel/services/AttachmentUploadService';
import {CallService} from '@fluxer/api/src/channel/services/CallService';
import {ChannelDataService} from '@fluxer/api/src/channel/services/ChannelDataService';
import {GroupDmService} from '@fluxer/api/src/channel/services/GroupDmService';
import {MessageInteractionService} from '@fluxer/api/src/channel/services/MessageInteractionService';
import {MessageService} from '@fluxer/api/src/channel/services/MessageService';
import {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import type {IFavoriteMemeRepository} from '@fluxer/api/src/favorite_meme/IFavoriteMemeRepository';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {AvatarService} from '@fluxer/api/src/infrastructure/AvatarService';
import type {IPurgeQueue} from '@fluxer/api/src/infrastructure/CloudflarePurgeQueue';
import type {EmbedService} from '@fluxer/api/src/infrastructure/EmbedService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {ILiveKitService} from '@fluxer/api/src/infrastructure/ILiveKitService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {IVoiceRoomStore} from '@fluxer/api/src/infrastructure/IVoiceRoomStore';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {IInviteRepository} from '@fluxer/api/src/invite/IInviteRepository';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {User} from '@fluxer/api/src/models/User';
import type {PackService} from '@fluxer/api/src/pack/PackService';
import type {ReadStateService} from '@fluxer/api/src/read_state/ReadStateService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {VoiceAvailabilityService} from '@fluxer/api/src/voice/VoiceAvailabilityService';
import type {IWebhookRepository} from '@fluxer/api/src/webhook/IWebhookRepository';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {TEXT_BASED_CHANNEL_TYPES} from '@fluxer/constants/src/ChannelConstants';
import {CannotSendMessageToNonTextChannelError} from '@fluxer/errors/src/domains/channel/CannotSendMessageToNonTextChannelError';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {IVirusScanService} from '@fluxer/virus_scan/src/IVirusScanService';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';

export class ChannelService {
	public readonly channelData: ChannelDataService;
	public readonly messages: MessageService;
	public readonly interactions: MessageInteractionService;
	public readonly attachments: AttachmentUploadService;
	public readonly groupDms: GroupDmService;
	public readonly calls: CallService;

	constructor(
		channelRepository: IChannelRepository,
		userRepository: IUserRepository,
		guildRepository: IGuildRepositoryAggregate,
		packService: PackService,
		userCacheService: UserCacheService,
		embedService: EmbedService,
		readStateService: ReadStateService,
		cacheService: ICacheService,
		storageService: IStorageService,
		gatewayService: IGatewayService,
		mediaService: IMediaService,
		avatarService: AvatarService,
		workerService: IWorkerService,
		virusScanService: IVirusScanService,
		snowflakeService: SnowflakeService,
		rateLimitService: IRateLimitService,
		purgeQueue: IPurgeQueue,
		favoriteMemeRepository: IFavoriteMemeRepository,
		guildAuditLogService: GuildAuditLogService,
		voiceRoomStore: IVoiceRoomStore,
		liveKitService: ILiveKitService,
		inviteRepository: IInviteRepository,
		webhookRepository: IWebhookRepository,
		limitConfigService: LimitConfigService,
		voiceAvailabilityService?: VoiceAvailabilityService,
	) {
		const messagePersistenceService = new MessagePersistenceService(
			channelRepository,
			userRepository,
			guildRepository,
			packService,
			embedService,
			storageService,
			mediaService,
			virusScanService,
			snowflakeService,
			readStateService,
			limitConfigService,
		);

		this.channelData = new ChannelDataService(
			channelRepository,
			userRepository,
			guildRepository,
			userCacheService,
			storageService,
			gatewayService,
			mediaService,
			avatarService,
			snowflakeService,
			purgeQueue,
			voiceRoomStore,
			liveKitService,
			voiceAvailabilityService,
			messagePersistenceService,
			guildAuditLogService,
			inviteRepository,
			webhookRepository,
			limitConfigService,
		);

		this.messages = new MessageService(
			channelRepository,
			userRepository,
			guildRepository,
			userCacheService,
			readStateService,
			cacheService,
			storageService,
			gatewayService,
			mediaService,
			workerService,
			snowflakeService,
			rateLimitService,
			purgeQueue,
			favoriteMemeRepository,
			guildAuditLogService,
			messagePersistenceService,
			limitConfigService,
		);

		this.interactions = new MessageInteractionService(
			channelRepository,
			userRepository,
			guildRepository,
			userCacheService,
			readStateService,
			gatewayService,
			mediaService,
			snowflakeService,
			messagePersistenceService,
			guildAuditLogService,
			limitConfigService,
		);

		this.attachments = new AttachmentUploadService(
			channelRepository,
			userRepository,
			storageService,
			purgeQueue,
			this.interactions.getChannelAuthenticated.bind(this.interactions),
			(channel) => {
				if (!TEXT_BASED_CHANNEL_TYPES.has(channel.type)) {
					throw new CannotSendMessageToNonTextChannelError();
				}
			},
			this.interactions.dispatchMessageUpdate.bind(this.interactions),
			this.messages.deleteMessage.bind(this.messages),
			limitConfigService,
		);

		this.groupDms = new GroupDmService(
			channelRepository,
			userRepository,
			guildRepository,
			userCacheService,
			gatewayService,
			mediaService,
			snowflakeService,
			this.channelData.groupDmUpdateService,
			this.messages.getMessagePersistenceService(),
			limitConfigService,
		);

		this.calls = new CallService(
			channelRepository,
			userRepository,
			guildRepository,
			gatewayService,
			userCacheService,
			mediaService,
			snowflakeService,
			readStateService,
			voiceAvailabilityService,
		);
	}

	async getChannel(...args: Parameters<ChannelDataService['getChannel']>) {
		return this.channelData.getChannel(...args);
	}

	async getChannelAuthenticated(...args: Parameters<ChannelDataService['getChannelAuthenticated']>) {
		return this.channelData.getChannelAuthenticated(...args);
	}

	async getPublicChannelData(...args: Parameters<ChannelDataService['getPublicChannelData']>) {
		return this.channelData.getPublicChannelData(...args);
	}

	async getChannelMemberCount(...args: Parameters<ChannelDataService['getChannelMemberCount']>) {
		return this.channelData.getChannelMemberCount(...args);
	}

	async getChannelSystem(...args: Parameters<ChannelDataService['getChannelSystem']>) {
		return this.channelData.getChannelSystem(...args);
	}

	async editChannel(...args: Parameters<ChannelDataService['editChannel']>) {
		return this.channelData.editChannel(...args);
	}

	async deleteChannel(...args: Parameters<ChannelDataService['deleteChannel']>) {
		return this.channelData.deleteChannel(...args);
	}

	async getAvailableRtcRegions(...args: Parameters<ChannelDataService['getAvailableRtcRegions']>) {
		return this.channelData.getAvailableRtcRegions(...args);
	}

	async sendMessage(...args: Parameters<MessageService['sendMessage']>) {
		return this.messages.sendMessage(...args);
	}

	async sendWebhookMessage(...args: Parameters<MessageService['sendWebhookMessage']>) {
		return this.messages.sendWebhookMessage(...args);
	}

	async validateMessageCanBeSent({
		user,
		channelId,
		data,
	}: {
		user: User;
		channelId: ChannelID;
		data: MessageRequest;
	}): Promise<void> {
		return this.messages.validateMessageCanBeSent({user, channelId, data});
	}

	async editMessage(...args: Parameters<MessageService['editMessage']>) {
		return this.messages.editMessage(...args);
	}

	async deleteMessage(...args: Parameters<MessageService['deleteMessage']>) {
		return this.messages.deleteMessage(...args);
	}

	async getMessage(...args: Parameters<MessageService['getMessage']>) {
		return this.messages.getMessage(...args);
	}

	async getMessages(...args: Parameters<MessageService['getMessages']>) {
		return this.messages.getMessages(...args);
	}

	async bulkDeleteMessages(...args: Parameters<MessageService['bulkDeleteMessages']>) {
		return this.messages.bulkDeleteMessages(...args);
	}

	async deleteUserMessagesInGuild(...args: Parameters<MessageService['deleteUserMessagesInGuild']>) {
		return this.messages.deleteUserMessagesInGuild(...args);
	}

	async sendJoinSystemMessage(...args: Parameters<MessageService['sendJoinSystemMessage']>) {
		return this.messages.sendJoinSystemMessage(...args);
	}

	async searchMessages(...args: Parameters<MessageService['searchMessages']>) {
		return this.messages.searchMessages(...args);
	}

	async anonymizeMessagesByAuthor(...args: Parameters<MessageService['anonymizeMessagesByAuthor']>) {
		return this.messages.anonymizeMessagesByAuthor(...args);
	}

	async addReaction(...args: Parameters<MessageInteractionService['addReaction']>) {
		return this.interactions.addReaction(...args);
	}

	async removeReaction(...args: Parameters<MessageInteractionService['removeReaction']>) {
		return this.interactions.removeReaction(...args);
	}

	async removeOwnReaction(...args: Parameters<MessageInteractionService['removeOwnReaction']>) {
		return this.interactions.removeOwnReaction(...args);
	}

	async removeAllReactions(...args: Parameters<MessageInteractionService['removeAllReactions']>) {
		return this.interactions.removeAllReactions(...args);
	}

	async removeAllReactionsForEmoji(...args: Parameters<MessageInteractionService['removeAllReactionsForEmoji']>) {
		return this.interactions.removeAllReactionsForEmoji(...args);
	}

	async getUsersForReaction(...args: Parameters<MessageInteractionService['getUsersForReaction']>) {
		return this.interactions.getUsersForReaction(...args);
	}

	async getMessageReactions(...args: Parameters<MessageInteractionService['getMessageReactions']>) {
		return this.interactions.getMessageReactions(...args);
	}

	async setHasReaction(...args: Parameters<MessageInteractionService['setHasReaction']>) {
		return this.interactions.setHasReaction(...args);
	}

	async pinMessage(...args: Parameters<MessageInteractionService['pinMessage']>) {
		return this.interactions.pinMessage(...args);
	}

	async unpinMessage(...args: Parameters<MessageInteractionService['unpinMessage']>) {
		return this.interactions.unpinMessage(...args);
	}

	async getChannelPins(...args: Parameters<MessageInteractionService['getChannelPins']>) {
		return this.interactions.getChannelPins(...args);
	}

	async startTyping(...args: Parameters<MessageInteractionService['startTyping']>) {
		return this.interactions.startTyping(...args);
	}

	async ackMessage(...args: Parameters<MessageInteractionService['ackMessage']>) {
		return this.interactions.ackMessage(...args);
	}

	async deleteReadState(...args: Parameters<MessageInteractionService['deleteReadState']>) {
		return this.interactions.deleteReadState(...args);
	}

	async ackPins(...args: Parameters<MessageInteractionService['ackPins']>) {
		return this.interactions.ackPins(...args);
	}

	async uploadFormDataAttachments(...args: Parameters<AttachmentUploadService['uploadFormDataAttachments']>) {
		return this.attachments.uploadFormDataAttachments(...args);
	}

	async deleteAttachment(...args: Parameters<AttachmentUploadService['deleteAttachment']>) {
		return this.attachments.deleteAttachment(...args);
	}

	async purgeChannelAttachments(...args: Parameters<AttachmentUploadService['purgeChannelAttachments']>) {
		return this.attachments.purgeChannelAttachments(...args);
	}

	async removeRecipientFromChannel(...args: Parameters<GroupDmService['removeRecipientFromChannel']>) {
		return this.groupDms.removeRecipientFromChannel(...args);
	}

	async updateGroupDmChannel(...args: Parameters<GroupDmService['updateGroupDmChannel']>) {
		return this.groupDms.updateGroupDmChannel(...args);
	}

	async checkCallEligibility(...args: Parameters<CallService['checkCallEligibility']>) {
		const [{channelId}] = args;
		const result = await this.calls.checkCallEligibility(...args);
		getMetricsService().counter({
			name: 'fluxer.voice.started',
			dimensions: {
				channel_id: channelId.toString(),
			},
		});
		return result;
	}

	async createOrGetCall(...args: Parameters<CallService['createOrGetCall']>) {
		return this.calls.createOrGetCall(...args);
	}

	async updateCall(...args: Parameters<CallService['updateCall']>) {
		return this.calls.updateCall(...args);
	}

	async ringCallRecipients(...args: Parameters<CallService['ringCallRecipients']>) {
		const [{channelId}] = args;
		const response = await this.calls.ringCallRecipients(...args);
		getMetricsService().counter({
			name: 'fluxer.voice.joined',
			dimensions: {
				channel_id: channelId.toString(),
			},
		});
		return response;
	}

	async stopRingingCallRecipients(...args: Parameters<CallService['stopRingingCallRecipients']>) {
		const [{channelId}] = args;
		const response = await this.calls.stopRingingCallRecipients(...args);
		getMetricsService().counter({
			name: 'fluxer.voice.left',
			dimensions: {
				channel_id: channelId.toString(),
			},
		});
		return response;
	}

	recordCallEnded({channelId}: {channelId: ChannelID}): void {
		getMetricsService().counter({
			name: 'fluxer.voice.ended',
			dimensions: {
				channel_id: channelId.toString(),
			},
		});
	}

	async setChannelPermissionOverwrite(params: Parameters<ChannelDataService['setChannelPermissionOverwrite']>[0]) {
		return this.channelData.setChannelPermissionOverwrite(params);
	}

	async deleteChannelPermissionOverwrite(
		params: Parameters<ChannelDataService['deleteChannelPermissionOverwrite']>[0],
	) {
		return this.channelData.deleteChannelPermissionOverwrite(params);
	}
}
