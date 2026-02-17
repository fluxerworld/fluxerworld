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
import {channelIdToUserId} from '@fluxer/api/src/BrandedTypes';
import {mapChannelToResponse} from '@fluxer/api/src/channel/ChannelMappers';
import {mapMessageToResponse} from '@fluxer/api/src/channel/MessageMappers';
import {collectMessageAttachments} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {GatewayDispatchEvent} from '@fluxer/api/src/constants/Gateway';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';

export async function dispatchChannelDelete({
	channel,
	requestCache,
	userCacheService,
	gatewayService,
}: {
	channel: Channel;
	requestCache: RequestCache;
	userCacheService: UserCacheService;
	gatewayService: IGatewayService;
}): Promise<void> {
	const channelResponse = await mapChannelToResponse({
		channel,
		currentUserId: null,
		userCacheService,
		requestCache,
	});

	await dispatchEvent({
		channel,
		event: 'CHANNEL_DELETE',
		data: channelResponse,
		gatewayService,
	});
}

export async function dispatchMessageCreate({
	channel,
	message,
	requestCache,
	currentUserId,
	nonce,
	userCacheService,
	gatewayService,
	mediaService,
	getReferencedMessage,
}: {
	channel: Channel;
	message: Message;
	requestCache: RequestCache;
	currentUserId?: UserID;
	nonce?: string;
	userCacheService: UserCacheService;
	gatewayService: IGatewayService;
	mediaService: IMediaService;
	getReferencedMessage?: (channelId: ChannelID, messageId: MessageID) => Promise<Message | null>;
}): Promise<void> {
	const decayService = new AttachmentDecayService();
	const messageAttachments = collectMessageAttachments(message);
	const attachmentDecayMap =
		messageAttachments.length > 0
			? await decayService.fetchMetadata(messageAttachments.map((att) => ({attachmentId: att.id})))
			: undefined;
	const messageResponse = await mapMessageToResponse({
		message,
		currentUserId,
		nonce,
		userCacheService,
		requestCache,
		mediaService,
		attachmentDecayMap,
		getReferencedMessage,
	});

	await dispatchEvent({
		channel,
		event: 'MESSAGE_CREATE',
		data: {...messageResponse, channel_type: channel.type},
		gatewayService,
	});
}

async function dispatchEvent(params: {
	channel: Channel;
	event: GatewayDispatchEvent;
	data: unknown;
	gatewayService: IGatewayService;
}): Promise<void> {
	const {channel, event, data, gatewayService} = params;

	if (channel.type === ChannelTypes.DM_PERSONAL_NOTES) {
		return gatewayService.dispatchPresence({
			userId: channelIdToUserId(channel.id),
			event,
			data,
		});
	}

	if (channel.guildId) {
		return gatewayService.dispatchGuild({guildId: channel.guildId, event, data});
	} else {
		for (const recipientId of channel.recipientIds) {
			await gatewayService.dispatchPresence({userId: recipientId, event, data});
		}
	}
}
