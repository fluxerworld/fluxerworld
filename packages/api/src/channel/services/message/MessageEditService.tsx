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

import type {ChannelID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {MessageUpdateRequest} from '@fluxer/api/src/channel/MessageTypes';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {MessageChannelAuthService} from '@fluxer/api/src/channel/services/message/MessageChannelAuthService';
import type {MessageDispatchService} from '@fluxer/api/src/channel/services/message/MessageDispatchService';
import type {MessageEmbedAttachmentResolver} from '@fluxer/api/src/channel/services/message/MessageEmbedAttachmentResolver';
import {isOperationDisabled} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {MessageMentionService} from '@fluxer/api/src/channel/services/message/MessageMentionService';
import type {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import type {MessageProcessingService} from '@fluxer/api/src/channel/services/message/MessageProcessingService';
import type {MessageSearchService} from '@fluxer/api/src/channel/services/message/MessageSearchService';
import type {MessageValidationService} from '@fluxer/api/src/channel/services/message/MessageValidationService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Message} from '@fluxer/api/src/models/Message';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildOperations} from '@fluxer/constants/src/GuildConstants';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import {FeatureTemporarilyDisabledError} from '@fluxer/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';

interface MessageEditServiceDeps {
	channelRepository: IChannelRepositoryAggregate;
	userRepository: IUserRepository;
	validationService: MessageValidationService;
	persistenceService: MessagePersistenceService;
	channelAuthService: MessageChannelAuthService;
	processingService: MessageProcessingService;
	dispatchService: MessageDispatchService;
	searchService: MessageSearchService;
	embedAttachmentResolver: MessageEmbedAttachmentResolver;
	mentionService: MessageMentionService;
}

export class MessageEditService {
	constructor(private readonly deps: MessageEditServiceDeps) {}

	async editMessage({
		userId,
		channelId,
		messageId,
		data,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		data: MessageUpdateRequest;
		requestCache: RequestCache;
	}): Promise<Message> {
		try {
			const {channel, guild, hasPermission, member} = await this.deps.channelAuthService.getChannelAuthenticated({
				userId,
				channelId,
			});

			const [canEmbedLinks, canMentionEveryone] = await Promise.all([
				hasPermission(Permissions.EMBED_LINKS),
				hasPermission(Permissions.MENTION_EVERYONE),
			]);

			if (data.embeds && data.embeds.length > 0 && !canEmbedLinks) {
				throw new MissingPermissionsError();
			}

			if (isOperationDisabled(guild, GuildOperations.SEND_MESSAGE)) {
				throw new FeatureTemporarilyDisabledError();
			}

			const message = await this.deps.channelRepository.messages.getMessage(channelId, messageId);
			if (!message) throw new UnknownMessageError();

			const user = await this.deps.userRepository.findUnique(userId);
			this.deps.validationService.validateMessageEditable(message);
			this.deps.validationService.validateMessageContent(data, user, {
				isUpdate: true,
				guildFeatures: guild?.features ?? null,
			});
			this.deps.embedAttachmentResolver.validateAttachmentReferences({
				embeds: data.embeds,
				attachments: data.attachments,
				existingAttachments: message.attachments.map((att) => ({filename: att.filename})),
			});

			const referencedMessage = message.reference
				? await this.deps.channelRepository.messages.getMessage(channelId, message.reference.messageId)
				: null;

			const hasMentionContentChanges = data.content !== undefined || data.allowed_mentions !== undefined;
			if (hasMentionContentChanges) {
				const mentionContent = data.content ?? message.content ?? '';
				this.deps.mentionService.extractMentions({
					content: mentionContent,
					referencedMessage,
					message: {
						id: message.id,
						channelId: message.channelId,
						authorId: message.authorId ?? userId,
						content: mentionContent,
						flags: data.flags ?? message.flags,
					} as Message,
					channelType: channel.type,
					allowedMentions: data.allowed_mentions ?? null,
					guild,
					canMentionEveryone,
				});
			}

			if (message.authorId !== userId) {
				return await this.deps.processingService.handleNonAuthorEdit({
					message,
					messageId,
					data,
					guild,
					hasPermission,
					channel,
					requestCache,
					persistenceService: this.deps.persistenceService,
					dispatchMessageUpdate: this.deps.dispatchService.dispatchMessageUpdate.bind(this.deps.dispatchService),
				});
			}

			const updatedMessage = await this.deps.persistenceService.updateMessage({
				message,
				messageId,
				data,
				channel,
				guild,
				member,
				allowEmbeds: canEmbedLinks,
			});

			if (data.content !== undefined || data.allowed_mentions !== undefined) {
				await this.deps.processingService.handleMentions({
					channel,
					message: updatedMessage,
					referencedMessageOnSend: referencedMessage,
					allowedMentions: data.allowed_mentions ?? null,
					guild,
					canMentionEveryone,
					canMentionRoles: canMentionEveryone,
				});
			}

			await this.deps.dispatchService.dispatchMessageUpdate({channel, message: updatedMessage, requestCache});

			if (channel.indexedAt) {
				void this.deps.searchService.updateMessageIndex(updatedMessage);
			}

			getMetricsService().counter({name: 'message.edit'});

			return updatedMessage;
		} catch (error) {
			getMetricsService().counter({name: 'message.edit.error'});
			throw error;
		}
	}
}
