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

import type {MessageID} from '@fluxer/api/src/BrandedTypes';
import {channelIdToUserId} from '@fluxer/api/src/BrandedTypes';
import type {GatewayDispatchEvent} from '@fluxer/api/src/constants/Gateway';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {Channel} from '@fluxer/api/src/models/Channel';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';

interface ChannelEventDispatcherDeps {
	gatewayService: IGatewayService;
}

export class ChannelEventDispatcher {
	constructor(private readonly deps: ChannelEventDispatcherDeps) {}

	async dispatchToChannel(channel: Channel, event: GatewayDispatchEvent, data: unknown): Promise<void> {
		if (channel.type === ChannelTypes.DM_PERSONAL_NOTES) {
			return this.deps.gatewayService.dispatchPresence({
				userId: channelIdToUserId(channel.id),
				event,
				data,
			});
		}

		if (channel.guildId) {
			return this.deps.gatewayService.dispatchGuild({
				guildId: channel.guildId,
				event,
				data,
			});
		}

		for (const recipientId of channel.recipientIds) {
			await this.deps.gatewayService.dispatchPresence({
				userId: recipientId,
				event,
				data,
			});
		}
	}

	async dispatchBulkDelete(channel: Channel, messageIds: Array<MessageID>): Promise<void> {
		if (messageIds.length === 0) {
			return;
		}

		await this.dispatchToChannel(channel, 'MESSAGE_DELETE_BULK', {
			channel_id: channel.id.toString(),
			ids: messageIds.map((id) => id.toString()),
		});
	}

	async dispatchMessageUpdate(channel: Channel, messageData: unknown): Promise<void> {
		await this.dispatchToChannel(channel, 'MESSAGE_UPDATE', messageData);
	}

	async dispatchMessageDelete(
		channel: Channel,
		messageId: MessageID,
		content?: string,
		authorId?: string,
	): Promise<void> {
		await this.dispatchToChannel(channel, 'MESSAGE_DELETE', {
			channel_id: channel.id.toString(),
			id: messageId.toString(),
			content,
			author_id: authorId,
		});
	}
}
