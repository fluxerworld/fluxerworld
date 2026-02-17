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

import ChannelPinsStore from '@app/stores/ChannelPinsStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import MessageReferenceStore from '@app/stores/MessageReferenceStore';
import MessageStore from '@app/stores/MessageStore';
import NotificationStore from '@app/stores/NotificationStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import RecentMentionsStore from '@app/stores/RecentMentionsStore';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import TtsUtils from '@app/utils/TtsUtils';

interface MessageDeletePayload {
	id: string;
	channel_id: string;
}

export function handleMessageDelete(data: MessageDeletePayload, _context: GatewayHandlerContext): void {
	SavedMessagesStore.handleMessageDelete(data.id);
	ChannelPinsStore.handleMessageDelete(data.channel_id, data.id);
	MessageStore.handleMessageDelete({channelId: data.channel_id, id: data.id});
	MessageReferenceStore.handleMessageDelete(data.channel_id, data.id);
	ReadStateStore.handleMessageDelete({channelId: data.channel_id});
	RecentMentionsStore.handleMessageDelete(data.id);
	NotificationStore.handleMessageDelete({channelId: data.channel_id});
	TtsUtils.handleMessageDelete(data.channel_id, data.id);
}
