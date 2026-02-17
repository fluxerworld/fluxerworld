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

import {AttachmentDecayService} from '@fluxer/api/src/attachment/AttachmentDecayService';
import type {ChannelID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import {mapMessageToResponse} from '@fluxer/api/src/channel/MessageMappers';
import type {MessageRequest, MessageUpdateRequest} from '@fluxer/api/src/channel/MessageTypes';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import {
	collectMessageAttachments,
	isPersonalNotesChannel,
} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Message} from '@fluxer/api/src/models/Message';
import type {User} from '@fluxer/api/src/models/User';
import type {AttachmentDecayRow} from '@fluxer/api/src/types/AttachmentDecayTypes';
import {UnclaimedAccountCannotSendMessagesError} from '@fluxer/errors/src/domains/channel/UnclaimedAccountCannotSendMessagesError';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

export class MessageRequestService {
	private readonly decayService = new AttachmentDecayService();

	constructor(
		private readonly channelService: ChannelService,
		private readonly channelRepository: IChannelRepository,
		private readonly userCacheService: UserCacheService,
		private readonly mediaService: IMediaService,
	) {}

	async listMessages(params: {
		userId: UserID;
		channelId: ChannelID;
		query: {limit: number; before?: MessageID; after?: MessageID; around?: MessageID};
		requestCache: RequestCache;
	}): Promise<Array<MessageResponse>> {
		const messages = await this.channelService.getMessages({
			userId: params.userId,
			channelId: params.channelId,
			limit: params.query.limit,
			before: params.query.before,
			after: params.query.after,
			around: params.query.around,
		});

		const attachmentDecayMap = await this.buildAttachmentDecayMap(messages);
		return Promise.all(
			messages.map((message) =>
				this.mapMessage({
					message,
					currentUserId: params.userId,
					requestCache: params.requestCache,
					attachmentDecayMap,
					includeReactions: true,
				}),
			),
		);
	}

	async getMessage(params: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		requestCache: RequestCache;
	}): Promise<MessageResponse> {
		const message = await this.channelService.getMessage({
			userId: params.userId,
			channelId: params.channelId,
			messageId: params.messageId,
		});

		const attachmentDecayMap = await this.buildAttachmentDecayMap([message]);
		return this.mapMessage({
			message,
			currentUserId: params.userId,
			requestCache: params.requestCache,
			attachmentDecayMap,
			includeReactions: true,
		});
	}

	async sendMessage(params: {
		user: User;
		channelId: ChannelID;
		data: MessageRequest;
		requestCache: RequestCache;
	}): Promise<MessageResponse> {
		if (
			params.user.isUnclaimedAccount() &&
			!isPersonalNotesChannel({userId: params.user.id, channelId: params.channelId})
		) {
			throw new UnclaimedAccountCannotSendMessagesError();
		}

		const message = await this.channelService.sendMessage({
			user: params.user,
			channelId: params.channelId,
			data: params.data,
			requestCache: params.requestCache,
		});

		const attachmentDecayMap = await this.buildAttachmentDecayMap([message]);
		return this.mapMessage({
			message,
			currentUserId: params.user.id,
			nonce: params.data.nonce,
			tts: params.data.tts,
			requestCache: params.requestCache,
			attachmentDecayMap,
		});
	}

	async editMessage(params: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		data: MessageUpdateRequest;
		requestCache: RequestCache;
	}): Promise<MessageResponse> {
		const message = await this.channelService.editMessage({
			userId: params.userId,
			channelId: params.channelId,
			messageId: params.messageId,
			data: params.data,
			requestCache: params.requestCache,
		});

		const attachmentDecayMap = await this.buildAttachmentDecayMap([message]);
		return this.mapMessage({
			message,
			currentUserId: params.userId,
			requestCache: params.requestCache,
			attachmentDecayMap,
		});
	}

	private async mapMessage(params: {
		message: Message;
		currentUserId: UserID;
		requestCache: RequestCache;
		attachmentDecayMap?: Map<string, AttachmentDecayRow>;
		nonce?: string;
		tts?: boolean;
		includeReactions?: boolean;
	}): Promise<MessageResponse> {
		const baseParams = {
			message: params.message,
			currentUserId: params.currentUserId,
			nonce: params.nonce,
			tts: params.tts,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
			mediaService: this.mediaService,
			attachmentDecayMap: params.attachmentDecayMap,
			getReferencedMessage: (channelId: ChannelID, messageId: MessageID) =>
				this.channelRepository.getMessage(channelId, messageId),
		};

		if (!params.includeReactions) {
			return mapMessageToResponse(baseParams);
		}

		return mapMessageToResponse({
			...baseParams,
			getReactions: (channelId: ChannelID, messageId: MessageID) =>
				this.channelService.getMessageReactions({
					userId: params.currentUserId,
					channelId,
					messageId,
				}),
			setHasReaction: (channelId: ChannelID, messageId: MessageID, hasReaction: boolean) =>
				this.channelService.setHasReaction(channelId, messageId, hasReaction),
		});
	}

	private async buildAttachmentDecayMap(
		messages: Array<Message>,
	): Promise<Map<string, AttachmentDecayRow> | undefined> {
		const allAttachments = messages.flatMap((message) => collectMessageAttachments(message));
		if (allAttachments.length === 0) {
			return undefined;
		}

		return this.decayService.fetchMetadata(allAttachments.map((att) => ({attachmentId: att.id})));
	}
}
