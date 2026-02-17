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

import type {ChannelID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {mapChannelToPartialResponse} from '@fluxer/api/src/channel/ChannelMappers';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {AuthenticatedChannel} from '@fluxer/api/src/channel/services/AuthenticatedChannel';
import {ChannelAuthService} from '@fluxer/api/src/channel/services/channel_data/ChannelAuthService';
import type {ChannelUpdateData} from '@fluxer/api/src/channel/services/channel_data/ChannelOperationsService';
import {ChannelOperationsService} from '@fluxer/api/src/channel/services/channel_data/ChannelOperationsService';
import {ChannelUtilsService} from '@fluxer/api/src/channel/services/channel_data/ChannelUtilsService';
import {GroupDmUpdateService} from '@fluxer/api/src/channel/services/channel_data/GroupDmUpdateService';
import type {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {AvatarService} from '@fluxer/api/src/infrastructure/AvatarService';
import type {IPurgeQueue} from '@fluxer/api/src/infrastructure/CloudflarePurgeQueue';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {ILiveKitService} from '@fluxer/api/src/infrastructure/ILiveKitService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {IVoiceRoomStore} from '@fluxer/api/src/infrastructure/IVoiceRoomStore';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {IInviteRepository} from '@fluxer/api/src/invite/IInviteRepository';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {VoiceAvailabilityService} from '@fluxer/api/src/voice/VoiceAvailabilityService';
import type {VoiceRegionAvailability} from '@fluxer/api/src/voice/VoiceModel';
import type {IWebhookRepository} from '@fluxer/api/src/webhook/IWebhookRepository';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {ChannelUpdateRequest} from '@fluxer/schema/src/domains/channel/ChannelRequestSchemas';
import type {ChannelPartialResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';

type GuildChannelUpdateRequest = Exclude<ChannelUpdateRequest, {type: typeof ChannelTypes.GROUP_DM}>;
type GuildChannelUpdatePayload = Omit<GuildChannelUpdateRequest, 'type'>;

export class ChannelDataService {
	private channelAuthService: ChannelAuthService;
	private channelOperationsService: ChannelOperationsService;
	public readonly groupDmUpdateService: GroupDmUpdateService;
	private channelUtilsService: ChannelUtilsService;

	constructor(
		channelRepository: IChannelRepositoryAggregate,
		userRepository: IUserRepository,
		guildRepository: IGuildRepositoryAggregate,
		userCacheService: UserCacheService,
		storageService: IStorageService,
		gatewayService: IGatewayService,
		mediaService: IMediaService,
		avatarService: AvatarService,
		snowflakeService: SnowflakeService,
		purgeQueue: IPurgeQueue,
		voiceRoomStore: IVoiceRoomStore,
		liveKitService: ILiveKitService,
		voiceAvailabilityService: VoiceAvailabilityService | undefined,
		messagePersistenceService: MessagePersistenceService,
		guildAuditLogService: GuildAuditLogService,
		inviteRepository: IInviteRepository,
		webhookRepository: IWebhookRepository,
		limitConfigService: LimitConfigService,
	) {
		this.channelUtilsService = new ChannelUtilsService(
			channelRepository,
			userCacheService,
			storageService,
			gatewayService,
			purgeQueue,
			mediaService,
		);

		this.channelAuthService = new ChannelAuthService(
			channelRepository,
			userRepository,
			guildRepository,
			gatewayService,
		);

		this.channelOperationsService = new ChannelOperationsService(
			channelRepository,
			userRepository,
			gatewayService,
			this.channelAuthService,
			this.channelUtilsService,
			voiceRoomStore,
			liveKitService,
			voiceAvailabilityService,
			guildAuditLogService,
			inviteRepository,
			webhookRepository,
			guildRepository,
			limitConfigService,
		);

		this.groupDmUpdateService = new GroupDmUpdateService(
			channelRepository,
			avatarService,
			snowflakeService,
			this.channelUtilsService,
			messagePersistenceService,
		);
	}

	async getChannel({userId, channelId}: {userId: UserID; channelId: ChannelID}): Promise<Channel> {
		return this.channelOperationsService.getChannel({userId, channelId});
	}

	async getChannelAuthenticated({
		userId,
		channelId,
	}: {
		userId: UserID;
		channelId: ChannelID;
	}): Promise<AuthenticatedChannel> {
		return this.channelAuthService.getChannelAuthenticated({userId, channelId});
	}

	async getPublicChannelData(channelId: ChannelID): Promise<ChannelPartialResponse> {
		const channel = await this.channelOperationsService.getPublicChannelData(channelId);
		return mapChannelToPartialResponse(channel);
	}

	async getChannelMemberCount(channelId: ChannelID): Promise<number> {
		return this.channelOperationsService.getChannelMemberCount(channelId);
	}

	async getChannelSystem(channelId: ChannelID): Promise<Channel | null> {
		return this.channelOperationsService.getChannelSystem(channelId);
	}

	async editChannel({
		userId,
		channelId,
		data,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		data: Omit<ChannelUpdateRequest, 'type'>;
		requestCache: RequestCache;
	}): Promise<Channel> {
		const {channel} = await this.channelAuthService.getChannelAuthenticated({userId, channelId});

		if (channel.type === ChannelTypes.GROUP_DM) {
			return await this.updateGroupDmChannel({
				userId,
				channelId,
				name: data.name !== undefined ? data.name : undefined,
				icon: data.icon !== undefined ? data.icon : undefined,
				ownerId: data.owner_id ? createUserID(data.owner_id) : undefined,
				nicks: data.nicks,
				requestCache,
			});
		}

		const guildChannelData = data as GuildChannelUpdatePayload;
		const channelUpdateData: ChannelUpdateData = {};

		if ('name' in guildChannelData && guildChannelData.name !== undefined && guildChannelData.name !== null) {
			channelUpdateData.name = guildChannelData.name;
		}

		if (guildChannelData.topic !== undefined) {
			channelUpdateData.topic = guildChannelData.topic ?? null;
		}

		if (guildChannelData.url !== undefined) {
			channelUpdateData.url = guildChannelData.url ?? null;
		}

		if (guildChannelData.parent_id !== undefined) {
			channelUpdateData.parent_id = guildChannelData.parent_id ?? null;
		}

		if (guildChannelData.bitrate !== undefined) {
			channelUpdateData.bitrate = guildChannelData.bitrate ?? null;
		}

		if (guildChannelData.user_limit !== undefined) {
			channelUpdateData.user_limit = guildChannelData.user_limit ?? null;
		}

		if (guildChannelData.nsfw !== undefined) {
			channelUpdateData.nsfw = guildChannelData.nsfw ?? undefined;
		}

		if (guildChannelData.rate_limit_per_user !== undefined) {
			channelUpdateData.rate_limit_per_user = guildChannelData.rate_limit_per_user ?? undefined;
		}

		if (guildChannelData.permission_overwrites !== undefined) {
			channelUpdateData.permission_overwrites = guildChannelData.permission_overwrites ?? null;
		}

		if (guildChannelData.rtc_region !== undefined) {
			channelUpdateData.rtc_region = guildChannelData.rtc_region ?? null;
		}

		if (guildChannelData.icon !== undefined) {
			channelUpdateData.icon = guildChannelData.icon ?? null;
		}

		if (guildChannelData.owner_id !== undefined) {
			channelUpdateData.owner_id = guildChannelData.owner_id ?? null;
		}

		if (guildChannelData.nicks !== undefined) {
			channelUpdateData.nicks = guildChannelData.nicks ?? null;
		}

		return this.channelOperationsService.editChannel({userId, channelId, data: channelUpdateData, requestCache});
	}

	async deleteChannel({
		userId,
		channelId,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		requestCache: RequestCache;
	}): Promise<void> {
		return this.channelOperationsService.deleteChannel({userId, channelId, requestCache});
	}

	async getAvailableRtcRegions({
		userId,
		channelId,
	}: {
		userId: UserID;
		channelId: ChannelID;
	}): Promise<Array<VoiceRegionAvailability>> {
		return this.channelOperationsService.getAvailableRtcRegions({userId, channelId});
	}

	async updateGroupDmChannel({
		userId,
		channelId,
		name,
		icon,
		ownerId,
		nicks,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		name?: string | null;
		icon?: string | null;
		ownerId?: UserID;
		nicks?: Record<string, string | null> | null;
		requestCache: RequestCache;
	}): Promise<Channel> {
		return this.groupDmUpdateService.updateGroupDmChannel({
			userId,
			channelId,
			name,
			icon,
			ownerId,
			nicks,
			requestCache,
		});
	}

	async setChannelPermissionOverwrite(params: {
		userId: UserID;
		channelId: ChannelID;
		overwriteId: bigint;
		overwrite: {type: number; allow_: bigint; deny_: bigint};
		requestCache: RequestCache;
	}) {
		return this.channelOperationsService.setChannelPermissionOverwrite(params);
	}

	async deleteChannelPermissionOverwrite(params: {
		userId: UserID;
		channelId: ChannelID;
		overwriteId: bigint;
		requestCache: RequestCache;
	}) {
		return this.channelOperationsService.deleteChannelPermissionOverwrite(params);
	}
}
