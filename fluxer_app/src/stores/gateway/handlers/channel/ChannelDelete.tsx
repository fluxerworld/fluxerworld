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
import ChannelStore from '@app/stores/ChannelStore';
import DraftStore from '@app/stores/DraftStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import InviteStore from '@app/stores/InviteStore';
import MessageStore from '@app/stores/MessageStore';
import PermissionStore from '@app/stores/PermissionStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import RecentMentionsStore from '@app/stores/RecentMentionsStore';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import SlowmodeStore from '@app/stores/SlowmodeStore';
import WebhookStore from '@app/stores/WebhookStore';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';

interface ChannelDeletePayload {
	id: string;
	type: number;
	guild_id?: string;
}

export function handleChannelDelete(data: ChannelDeletePayload, _context: GatewayHandlerContext): void {
	const channel = data as Channel;
	const guildId = data.guild_id;

	SlowmodeStore.deleteChannel(data.id);
	DraftStore.deleteChannelDraft(data.id);
	SavedMessagesStore.handleChannelDelete(channel);
	ChannelPinsStore.handleChannelDelete(channel);
	ChannelStore.handleChannelDelete({channel});
	PermissionStore.handleChannelDelete(data.id, guildId);
	GuildReadStateStore.handleChannelDelete(data.id);
	InviteStore.handleChannelDelete(data.id);
	WebhookStore.handleChannelDelete(data.id);
	ReadStateStore.handleChannelDelete({channel});
	SelectedChannelStore.handleChannelDelete(channel);
	MessageStore.handleCleanup();
	RecentMentionsStore.handleChannelDelete(channel);
	QuickSwitcherStore.recomputeIfOpen();
}
