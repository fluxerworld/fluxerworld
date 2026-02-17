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

import ChannelStore from '@app/stores/ChannelStore';
import EmojiStore from '@app/stores/EmojiStore';
import GuildAvailabilityStore from '@app/stores/GuildAvailabilityStore';
import GuildListStore from '@app/stores/GuildListStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import GuildStore from '@app/stores/GuildStore';
import GuildVerificationStore from '@app/stores/GuildVerificationStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import InviteStore from '@app/stores/InviteStore';
import MemberSearchStore from '@app/stores/MemberSearchStore';
import MemberSidebarStore from '@app/stores/MemberSidebarStore';
import MessageStore from '@app/stores/MessageStore';
import PermissionStore from '@app/stores/PermissionStore';
import PresenceStore from '@app/stores/PresenceStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import RecentMentionsStore from '@app/stores/RecentMentionsStore';
import StickerStore from '@app/stores/StickerStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import WebhookStore from '@app/stores/WebhookStore';
import type {Guild} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';

interface GuildDeletePayload {
	id: string;
	unavailable?: boolean;
}

export function handleGuildDelete(data: GuildDeletePayload, _context: GatewayHandlerContext): void {
	GuildAvailabilityStore.handleGuildAvailability(data.id, data.unavailable);
	GuildStore.handleGuildDelete({guildId: data.id, unavailable: data.unavailable});
	GuildListStore.handleGuildDelete(data.id, data.unavailable);
	GuildMemberStore.handleGuildDelete(data.id);
	GuildReadStateStore.handleGuildDelete({guild: data as Guild});
	GuildVerificationStore.handleGuildDelete(data.id);
	ChannelStore.handleGuildDelete({guildId: data.id});
	StickerStore.handleGuildDelete(data.id);
	EmojiStore.handleGuildDelete({guildId: data.id});
	PermissionStore.handleGuild();
	InviteStore.handleGuildDelete(data.id);
	PresenceStore.handleGuildDelete(data.id);
	WebhookStore.handleGuildDelete(data.id);
	MediaEngineStore.handleGuildDelete(data.id);
	MemberSidebarStore.handleGuildDelete(data.id);
	MessageStore.handleGuildUnavailable(data.id, data.unavailable ?? false);
	MessageStore.handleCleanup();
	RecentMentionsStore.handleGuildDelete(data.id);
	MemberSearchStore.handleGuildDelete(data.id);

	QuickSwitcherStore.recomputeIfOpen();
}
