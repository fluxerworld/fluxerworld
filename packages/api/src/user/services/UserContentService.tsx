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

import crypto from 'node:crypto';
import type {ChannelID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import {mapMessageToResponse} from '@fluxer/api/src/channel/MessageMappers';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {PushSubscriptionRow} from '@fluxer/api/src/database/types/UserTypes';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {KVBulkMessageDeletionQueueService} from '@fluxer/api/src/infrastructure/KVBulkMessageDeletionQueueService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {Logger} from '@fluxer/api/src/Logger';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Message} from '@fluxer/api/src/models/Message';
import type {PushSubscription} from '@fluxer/api/src/models/PushSubscription';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import type {IUserContentRepository} from '@fluxer/api/src/user/repositories/IUserContentRepository';
import {BaseUserUpdatePropagator} from '@fluxer/api/src/user/services/BaseUserUpdatePropagator';
import {UserHarvest, type UserHarvestResponse} from '@fluxer/api/src/user/UserHarvestModel';
import {UserHarvestRepository} from '@fluxer/api/src/user/UserHarvestRepository';
import {MAX_BOOKMARKS_NON_PREMIUM} from '@fluxer/constants/src/LimitConstants';
import {UnknownChannelError} from '@fluxer/errors/src/domains/channel/UnknownChannelError';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import {MaxBookmarksError} from '@fluxer/errors/src/domains/core/MaxBookmarksError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {HarvestExpiredError} from '@fluxer/errors/src/domains/moderation/HarvestExpiredError';
import {HarvestFailedError} from '@fluxer/errors/src/domains/moderation/HarvestFailedError';
import {HarvestNotReadyError} from '@fluxer/errors/src/domains/moderation/HarvestNotReadyError';
import {HarvestOnCooldownError} from '@fluxer/errors/src/domains/moderation/HarvestOnCooldownError';
import {UnknownHarvestError} from '@fluxer/errors/src/domains/moderation/UnknownHarvestError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {SavedMessageStatus} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';
import {ms} from 'itty-time';

export interface SavedMessageEntry {
	channelId: ChannelID;
	messageId: MessageID;
	status: SavedMessageStatus;
	message: Message | null;
}

export class UserContentService {
	private readonly updatePropagator: BaseUserUpdatePropagator;

	constructor(
		private userAccountRepository: IUserAccountRepository,
		private userContentRepository: IUserContentRepository,
		userCacheService: UserCacheService,
		private channelService: ChannelService,
		private channelRepository: IChannelRepository,
		private gatewayService: IGatewayService,
		private mediaService: IMediaService,
		private workerService: IWorkerService,
		private snowflakeService: SnowflakeService,
		private bulkMessageDeletionQueue: KVBulkMessageDeletionQueueService,
		private limitConfigService: LimitConfigService,
	) {
		this.updatePropagator = new BaseUserUpdatePropagator({
			userCacheService,
			gatewayService: this.gatewayService,
		});
	}

	async getRecentMentions(params: {
		userId: UserID;
		limit: number;
		everyone: boolean;
		roles: boolean;
		guilds: boolean;
		before?: MessageID;
	}): Promise<Array<Message>> {
		const {userId, limit, everyone, roles, guilds, before} = params;
		const mentions = await this.userContentRepository.listRecentMentions(
			userId,
			everyone,
			roles,
			guilds,
			limit,
			before,
		);
		const messagePromises = mentions.map(async (mention) => {
			try {
				return await this.channelService.getMessage({
					userId,
					channelId: mention.channelId,
					messageId: mention.messageId,
				});
			} catch (error) {
				if (error instanceof UnknownMessageError) {
					return null;
				}
				throw error;
			}
		});
		const messageResults = await Promise.all(messagePromises);
		const messages = messageResults.filter((message): message is Message => message != null);
		return messages.sort((a, b) => (b.id > a.id ? 1 : -1));
	}

	async deleteRecentMention({userId, messageId}: {userId: UserID; messageId: MessageID}): Promise<void> {
		const recentMention = await this.userContentRepository.getRecentMention(userId, messageId);
		if (!recentMention) return;
		await this.userContentRepository.deleteRecentMention(recentMention);
		await this.dispatchRecentMentionDelete({userId, messageId});
	}

	async getSavedMessages({userId, limit}: {userId: UserID; limit: number}): Promise<Array<SavedMessageEntry>> {
		const savedMessages = await this.userContentRepository.listSavedMessages(userId, limit);

		const messagePromises = savedMessages.map(async (savedMessage) => {
			let message: Message | null = null;
			let status: SavedMessageStatus = 'available';

			try {
				message = await this.channelService.getMessage({
					userId,
					channelId: savedMessage.channelId,
					messageId: savedMessage.messageId,
				});
			} catch (error) {
				if (error instanceof UnknownMessageError) {
					await this.userContentRepository.deleteSavedMessage(userId, savedMessage.messageId);
					return null;
				}
				if (error instanceof MissingPermissionsError || error instanceof UnknownChannelError) {
					status = 'missing_permissions';
				} else {
					throw error;
				}
			}

			return {
				channelId: savedMessage.channelId,
				messageId: savedMessage.messageId,
				status,
				message,
			};
		});

		const messageResults = await Promise.all(messagePromises);
		const results = messageResults.filter((result): result is NonNullable<typeof result> => result != null);

		return results.sort((a, b) => (b.messageId > a.messageId ? 1 : a.messageId > b.messageId ? -1 : 0));
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
		const user = await this.userAccountRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const savedMessages = await this.userContentRepository.listSavedMessages(userId, 1000);
		const ctx = createLimitMatchContext({user});
		const maxBookmarks = resolveLimitSafe(
			this.limitConfigService.getConfigSnapshot(),
			ctx,
			'max_bookmarks',
			MAX_BOOKMARKS_NON_PREMIUM,
		);

		if (savedMessages.length >= maxBookmarks) {
			throw new MaxBookmarksError({maxBookmarks});
		}

		await this.channelService.getChannelAuthenticated({userId, channelId});
		const message = await this.channelService.getMessage({userId, channelId, messageId});
		if (!message) {
			throw new UnknownMessageError();
		}
		await this.userContentRepository.createSavedMessage(userId, channelId, messageId);
		await this.dispatchSavedMessageCreate({userId, message, userCacheService, requestCache});
	}

	async unsaveMessage({userId, messageId}: {userId: UserID; messageId: MessageID}): Promise<void> {
		await this.userContentRepository.deleteSavedMessage(userId, messageId);
		await this.dispatchSavedMessageDelete({userId, messageId});
	}

	async registerPushSubscription(params: {
		userId: UserID;
		endpoint: string;
		keys: {p256dh: string; auth: string};
		userAgent?: string;
	}): Promise<PushSubscription> {
		const {userId, endpoint, keys, userAgent} = params;

		const subscriptionId = crypto.createHash('sha256').update(endpoint).digest('hex').substring(0, 32);

		const data: PushSubscriptionRow = {
			user_id: userId,
			subscription_id: subscriptionId,
			endpoint,
			p256dh_key: keys.p256dh,
			auth_key: keys.auth,
			user_agent: userAgent ?? null,
		};

		return await this.userContentRepository.createPushSubscription(data);
	}

	async listPushSubscriptions(userId: UserID): Promise<Array<PushSubscription>> {
		return await this.userContentRepository.listPushSubscriptions(userId);
	}

	async deletePushSubscription(userId: UserID, subscriptionId: string): Promise<void> {
		await this.userContentRepository.deletePushSubscription(userId, subscriptionId);
	}

	async requestDataHarvest(userId: UserID): Promise<{
		harvest_id: string;
		status: 'pending' | 'processing' | 'completed' | 'failed';
		created_at: string;
	}> {
		const user = await this.userAccountRepository.findUnique(userId);
		if (!user) throw new UnknownUserError();

		if (!Config.dev.testModeEnabled) {
			const harvestRepository = new UserHarvestRepository();
			const latestHarvest = await harvestRepository.findLatestByUserId(userId);

			if (latestHarvest?.requestedAt) {
				const sevenDaysAgo = new Date(Date.now() - ms('7 days'));
				if (latestHarvest.requestedAt > sevenDaysAgo) {
					const retryAfter = new Date(latestHarvest.requestedAt.getTime() + ms('7 days'));
					throw new HarvestOnCooldownError({retryAfter});
				}
			}
		}

		const harvestId = await this.snowflakeService.generate();
		const harvest = new UserHarvest({
			user_id: userId,
			harvest_id: harvestId,
			requested_at: new Date(),
			started_at: null,
			completed_at: null,
			failed_at: null,
			storage_key: null,
			file_size: null,
			progress_percent: 0,
			progress_step: 'Queued',
			error_message: null,
			download_url_expires_at: null,
		});

		const harvestRepository = new UserHarvestRepository();
		await harvestRepository.create(harvest);

		await this.workerService.addJob('harvestUserData', {
			userId: userId.toString(),
			harvestId: harvestId.toString(),
		});

		return {
			harvest_id: harvest.harvestId.toString(),
			status: harvest.getStatus(),
			created_at: harvest.requestedAt.toISOString(),
		};
	}

	async getHarvestStatus(userId: UserID, harvestId: bigint): Promise<UserHarvestResponse> {
		const harvestRepository = new UserHarvestRepository();
		const harvest = await harvestRepository.findByUserAndHarvestId(userId, harvestId);
		if (!harvest) {
			throw new UnknownHarvestError();
		}
		return harvest.toResponse();
	}

	async getLatestHarvest(userId: UserID): Promise<UserHarvestResponse | null> {
		const harvestRepository = new UserHarvestRepository();
		const harvest = await harvestRepository.findLatestByUserId(userId);
		return harvest ? harvest.toResponse() : null;
	}

	async getHarvestDownloadUrl(
		userId: UserID,
		harvestId: bigint,
		storageService: IStorageService,
	): Promise<{download_url: string; expires_at: string}> {
		const harvestRepository = new UserHarvestRepository();
		const harvest = await harvestRepository.findByUserAndHarvestId(userId, harvestId);

		if (!harvest) {
			throw new UnknownHarvestError();
		}

		if (!harvest.completedAt || !harvest.storageKey) {
			throw new HarvestNotReadyError();
		}

		if (harvest.failedAt) {
			throw new HarvestFailedError();
		}

		if (harvest.downloadUrlExpiresAt && harvest.downloadUrlExpiresAt < new Date()) {
			throw new HarvestExpiredError();
		}

		const ZIP_EXPIRY_MS = ms('7 days');
		const downloadUrl = await storageService.getPresignedDownloadURL({
			bucket: Config.s3.buckets.harvests,
			key: harvest.storageKey,
			expiresIn: ZIP_EXPIRY_MS / 1000,
		});

		const expiresAt = new Date(Date.now() + ZIP_EXPIRY_MS);

		return {
			download_url: downloadUrl,
			expires_at: expiresAt.toISOString(),
		};
	}

	async requestBulkMessageDeletion(params: {userId: UserID; delayMs?: number}): Promise<void> {
		const {userId, delayMs = ms('1 day')} = params;
		const scheduledAt = new Date(Date.now() + delayMs);

		const user = await this.userAccountRepository.findUniqueAssert(userId);
		await this.bulkMessageDeletionQueue.removeFromQueue(userId);

		const counts = await this.countBulkDeletionTargets(userId, scheduledAt.getTime());
		Logger.debug(
			{
				userId: userId.toString(),
				channelCount: counts.channelCount,
				messageCount: counts.messageCount,
				scheduledAt: scheduledAt.toISOString(),
			},
			'Scheduling bulk message deletion',
		);

		const updatedUser = await this.userAccountRepository.patchUpsert(
			userId,
			{
				pending_bulk_message_deletion_at: scheduledAt,
				pending_bulk_message_deletion_channel_count: counts.channelCount,
				pending_bulk_message_deletion_message_count: counts.messageCount,
			},
			user.toRow(),
		);

		await this.bulkMessageDeletionQueue.scheduleDeletion(userId, scheduledAt);

		await this.updatePropagator.dispatchUserUpdate(updatedUser);
	}

	async cancelBulkMessageDeletion(userId: UserID): Promise<void> {
		Logger.debug({userId: userId.toString()}, 'Canceling pending bulk message deletion');
		const user = await this.userAccountRepository.findUniqueAssert(userId);
		const updatedUser = await this.userAccountRepository.patchUpsert(
			userId,
			{
				pending_bulk_message_deletion_at: null,
				pending_bulk_message_deletion_channel_count: null,
				pending_bulk_message_deletion_message_count: null,
			},
			user.toRow(),
		);

		await this.bulkMessageDeletionQueue.removeFromQueue(userId);

		await this.updatePropagator.dispatchUserUpdate(updatedUser);
	}

	private async countBulkDeletionTargets(
		userId: UserID,
		cutoffMs: number,
	): Promise<{
		channelCount: number;
		messageCount: number;
	}> {
		const CHUNK_SIZE = 200;
		let lastMessageId: MessageID | undefined;
		const channels = new Set<string>();
		let messageCount = 0;

		while (true) {
			const messageRefs = await this.channelRepository.listMessagesByAuthor(userId, CHUNK_SIZE, lastMessageId);
			if (messageRefs.length === 0) {
				break;
			}

			for (const {channelId, messageId} of messageRefs) {
				if (snowflakeToDate(messageId).getTime() > cutoffMs) {
					continue;
				}
				channels.add(channelId.toString());
				messageCount++;
			}

			lastMessageId = messageRefs[messageRefs.length - 1].messageId;

			if (messageRefs.length < CHUNK_SIZE) {
				break;
			}
		}

		return {
			channelCount: channels.size,
			messageCount,
		};
	}

	async dispatchRecentMentionDelete({userId, messageId}: {userId: UserID; messageId: MessageID}): Promise<void> {
		await this.gatewayService.dispatchPresence({
			userId,
			event: 'RECENT_MENTION_DELETE',
			data: {message_id: messageId.toString()},
		});
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
		await this.gatewayService.dispatchPresence({
			userId,
			event: 'SAVED_MESSAGE_CREATE',
			data: await mapMessageToResponse({
				message,
				currentUserId: userId,
				userCacheService,
				requestCache,
				mediaService: this.mediaService,
			}),
		});
	}

	async dispatchSavedMessageDelete({userId, messageId}: {userId: UserID; messageId: MessageID}): Promise<void> {
		await this.gatewayService.dispatchPresence({
			userId,
			event: 'SAVED_MESSAGE_DELETE',
			data: {message_id: messageId.toString()},
		});
	}
}
