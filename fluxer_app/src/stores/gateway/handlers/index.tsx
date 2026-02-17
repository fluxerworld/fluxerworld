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

import type {GatewaySocket} from '@app/lib/GatewaySocket';
import {handleCallCreate} from '@app/stores/gateway/handlers/call/CallCreate';
import {handleCallDelete} from '@app/stores/gateway/handlers/call/CallDelete';
import {handleCallUpdate} from '@app/stores/gateway/handlers/call/CallUpdate';
import {handleChannelCreate} from '@app/stores/gateway/handlers/channel/ChannelCreate';
import {handleChannelDelete} from '@app/stores/gateway/handlers/channel/ChannelDelete';
import {handleChannelPinsAck} from '@app/stores/gateway/handlers/channel/ChannelPinsAck';
import {handleChannelPinsUpdate} from '@app/stores/gateway/handlers/channel/ChannelPinsUpdate';
import {handleChannelRecipientAdd} from '@app/stores/gateway/handlers/channel/ChannelRecipientAdd';
import {handleChannelRecipientRemove} from '@app/stores/gateway/handlers/channel/ChannelRecipientRemove';
import {handleChannelUpdate} from '@app/stores/gateway/handlers/channel/ChannelUpdate';
import {handleChannelUpdateBulk} from '@app/stores/gateway/handlers/channel/ChannelUpdateBulk';
import {handleGuildBan} from '@app/stores/gateway/handlers/guild/GuildBan';
import {handleGuildCreate} from '@app/stores/gateway/handlers/guild/GuildCreate';
import {handleGuildDelete} from '@app/stores/gateway/handlers/guild/GuildDelete';
import {handleGuildEmojisUpdate} from '@app/stores/gateway/handlers/guild/GuildEmojisUpdate';
import {handleGuildMemberAdd} from '@app/stores/gateway/handlers/guild/GuildMemberAdd';
import {handleGuildMemberListUpdate} from '@app/stores/gateway/handlers/guild/GuildMemberListUpdate';
import {handleGuildMemberRemove} from '@app/stores/gateway/handlers/guild/GuildMemberRemove';
import {handleGuildMembersChunk} from '@app/stores/gateway/handlers/guild/GuildMembersChunk';
import {handleGuildMemberUpdate} from '@app/stores/gateway/handlers/guild/GuildMemberUpdate';
import {handleGuildRoleCreate} from '@app/stores/gateway/handlers/guild/GuildRoleCreate';
import {handleGuildRoleDelete} from '@app/stores/gateway/handlers/guild/GuildRoleDelete';
import {handleGuildRoleUpdate} from '@app/stores/gateway/handlers/guild/GuildRoleUpdate';
import {handleGuildRoleUpdateBulk} from '@app/stores/gateway/handlers/guild/GuildRoleUpdateBulk';
import {handleGuildStickersUpdate} from '@app/stores/gateway/handlers/guild/GuildStickersUpdate';
import {handleGuildSync} from '@app/stores/gateway/handlers/guild/GuildSync';
import {handleGuildUpdate} from '@app/stores/gateway/handlers/guild/GuildUpdate';
import {handlePassiveUpdates} from '@app/stores/gateway/handlers/guild/PassiveUpdates';
import {handleInviteCreate} from '@app/stores/gateway/handlers/invite/InviteCreate';
import {handleInviteDelete} from '@app/stores/gateway/handlers/invite/InviteDelete';
import {handleMessageAck} from '@app/stores/gateway/handlers/message/MessageAck';
import {handleMessageCreate} from '@app/stores/gateway/handlers/message/MessageCreate';
import {handleMessageDelete} from '@app/stores/gateway/handlers/message/MessageDelete';
import {handleMessageDeleteBulk} from '@app/stores/gateway/handlers/message/MessageDeleteBulk';
import {handleMessageReactionAdd} from '@app/stores/gateway/handlers/message/MessageReactionAdd';
import {handleMessageReactionAddMany} from '@app/stores/gateway/handlers/message/MessageReactionAddMany';
import {handleMessageReactionRemove} from '@app/stores/gateway/handlers/message/MessageReactionRemove';
import {handleMessageReactionRemoveAll} from '@app/stores/gateway/handlers/message/MessageReactionRemoveAll';
import {handleMessageReactionRemoveEmoji} from '@app/stores/gateway/handlers/message/MessageReactionRemoveEmoji';
import {handleMessageUpdate} from '@app/stores/gateway/handlers/message/MessageUpdate';
import {handleRecentMentionDelete} from '@app/stores/gateway/handlers/message/RecentMentionDelete';
import {handleSavedMessageCreate} from '@app/stores/gateway/handlers/message/SavedMessageCreate';
import {handleSavedMessageDelete} from '@app/stores/gateway/handlers/message/SavedMessageDelete';
import {handleTypingStart} from '@app/stores/gateway/handlers/message/TypingStart';
import {handleFavoriteMemeCreate} from '@app/stores/gateway/handlers/misc/FavoriteMemeCreate';
import {handleFavoriteMemeDelete} from '@app/stores/gateway/handlers/misc/FavoriteMemeDelete';
import {handleFavoriteMemeUpdate} from '@app/stores/gateway/handlers/misc/FavoriteMemeUpdate';
import {handleWebhooksUpdate} from '@app/stores/gateway/handlers/misc/WebhooksUpdate';
import {handlePresenceUpdate} from '@app/stores/gateway/handlers/presence/PresenceUpdate';
import {handlePresenceUpdateBulk} from '@app/stores/gateway/handlers/presence/PresenceUpdateBulk';
import {handleReady} from '@app/stores/gateway/handlers/Ready';
import {handleResumed} from '@app/stores/gateway/handlers/Resumed';
import {handleRelationshipAdd} from '@app/stores/gateway/handlers/relationship/RelationshipAdd';
import {handleRelationshipRemove} from '@app/stores/gateway/handlers/relationship/RelationshipRemove';
import {handleRelationshipUpdate} from '@app/stores/gateway/handlers/relationship/RelationshipUpdate';
import {handleAuthSessionChange} from '@app/stores/gateway/handlers/user/AuthSessionChange';
import {handleUserConnectionsUpdate} from '@app/stores/gateway/handlers/user/UserConnectionsUpdate';
import {handleUserGuildSettingsUpdate} from '@app/stores/gateway/handlers/user/UserGuildSettingsUpdate';
import {handleUserNoteUpdate} from '@app/stores/gateway/handlers/user/UserNoteUpdate';
import {handleUserPinnedDmsUpdate} from '@app/stores/gateway/handlers/user/UserPinnedDmsUpdate';
import {handleUserSettingsUpdate} from '@app/stores/gateway/handlers/user/UserSettingsUpdate';
import {handleUserUpdate} from '@app/stores/gateway/handlers/user/UserUpdate';
import {handleVoiceServerUpdate} from '@app/stores/gateway/handlers/voice/VoiceServerUpdate';
import {handleVoiceStateUpdate} from '@app/stores/gateway/handlers/voice/VoiceStateUpdate';

export interface GatewayHandlerContext {
	socket: GatewaySocket | null;
	previousSessionId: string | null;
	setPreviousSessionId: (id: string) => void;
	setReady: () => void;
}

export type GatewayEventHandler = (data: unknown, context: GatewayHandlerContext) => void;
export type GatewayHandlerRegistry = Map<string, GatewayEventHandler>;

export function createHandlerRegistry(): GatewayHandlerRegistry {
	const registry: GatewayHandlerRegistry = new Map();

	registry.set('READY', handleReady as GatewayEventHandler);
	registry.set('RESUMED', handleResumed as GatewayEventHandler);

	registry.set('AUTH_SESSION_CHANGE', handleAuthSessionChange as GatewayEventHandler);
	registry.set('USER_UPDATE', handleUserUpdate as GatewayEventHandler);
	registry.set('USER_SETTINGS_UPDATE', handleUserSettingsUpdate as GatewayEventHandler);
	registry.set('USER_GUILD_SETTINGS_UPDATE', handleUserGuildSettingsUpdate as GatewayEventHandler);
	registry.set('USER_PINNED_DMS_UPDATE', handleUserPinnedDmsUpdate as GatewayEventHandler);
	registry.set('USER_NOTE_UPDATE', handleUserNoteUpdate as GatewayEventHandler);
	registry.set('USER_CONNECTIONS_UPDATE', handleUserConnectionsUpdate as GatewayEventHandler);

	registry.set('GUILD_CREATE', handleGuildCreate as GatewayEventHandler);
	registry.set('GUILD_UPDATE', handleGuildUpdate as GatewayEventHandler);
	registry.set('GUILD_DELETE', handleGuildDelete as GatewayEventHandler);
	registry.set('GUILD_BAN_ADD', handleGuildBan as GatewayEventHandler);
	registry.set('GUILD_BAN_REMOVE', handleGuildBan as GatewayEventHandler);
	registry.set('GUILD_EMOJIS_UPDATE', handleGuildEmojisUpdate as GatewayEventHandler);
	registry.set('GUILD_STICKERS_UPDATE', handleGuildStickersUpdate as GatewayEventHandler);
	registry.set('GUILD_SYNC', handleGuildSync as GatewayEventHandler);
	registry.set('GUILD_MEMBER_ADD', handleGuildMemberAdd as GatewayEventHandler);
	registry.set('GUILD_MEMBER_UPDATE', handleGuildMemberUpdate as GatewayEventHandler);
	registry.set('GUILD_MEMBER_REMOVE', handleGuildMemberRemove as GatewayEventHandler);
	registry.set('GUILD_MEMBERS_CHUNK', handleGuildMembersChunk as GatewayEventHandler);
	registry.set('GUILD_MEMBER_LIST_UPDATE', handleGuildMemberListUpdate as GatewayEventHandler);
	registry.set('GUILD_ROLE_CREATE', handleGuildRoleCreate as GatewayEventHandler);
	registry.set('GUILD_ROLE_UPDATE', handleGuildRoleUpdate as GatewayEventHandler);
	registry.set('GUILD_ROLE_DELETE', handleGuildRoleDelete as GatewayEventHandler);
	registry.set('GUILD_ROLE_UPDATE_BULK', handleGuildRoleUpdateBulk as GatewayEventHandler);

	registry.set('CHANNEL_CREATE', handleChannelCreate as GatewayEventHandler);
	registry.set('CHANNEL_UPDATE', handleChannelUpdate as GatewayEventHandler);
	registry.set('CHANNEL_UPDATE_BULK', handleChannelUpdateBulk as GatewayEventHandler);
	registry.set('CHANNEL_DELETE', handleChannelDelete as GatewayEventHandler);
	registry.set('PASSIVE_UPDATES', handlePassiveUpdates as GatewayEventHandler);
	registry.set('CHANNEL_PINS_UPDATE', handleChannelPinsUpdate as GatewayEventHandler);
	registry.set('CHANNEL_PINS_ACK', handleChannelPinsAck as GatewayEventHandler);
	registry.set('CHANNEL_RECIPIENT_ADD', handleChannelRecipientAdd as GatewayEventHandler);
	registry.set('CHANNEL_RECIPIENT_REMOVE', handleChannelRecipientRemove as GatewayEventHandler);

	registry.set('MESSAGE_CREATE', handleMessageCreate as GatewayEventHandler);
	registry.set('MESSAGE_UPDATE', handleMessageUpdate as GatewayEventHandler);
	registry.set('MESSAGE_DELETE', handleMessageDelete as GatewayEventHandler);
	registry.set('MESSAGE_DELETE_BULK', handleMessageDeleteBulk as GatewayEventHandler);
	registry.set('MESSAGE_ACK', handleMessageAck as GatewayEventHandler);
	registry.set('MESSAGE_REACTION_ADD', handleMessageReactionAdd as GatewayEventHandler);
	registry.set('MESSAGE_REACTION_ADD_MANY', handleMessageReactionAddMany as GatewayEventHandler);
	registry.set('MESSAGE_REACTION_REMOVE', handleMessageReactionRemove as GatewayEventHandler);
	registry.set('MESSAGE_REACTION_REMOVE_ALL', handleMessageReactionRemoveAll as GatewayEventHandler);
	registry.set('MESSAGE_REACTION_REMOVE_EMOJI', handleMessageReactionRemoveEmoji as GatewayEventHandler);
	registry.set('TYPING_START', handleTypingStart as GatewayEventHandler);
	registry.set('RECENT_MENTION_DELETE', handleRecentMentionDelete as GatewayEventHandler);
	registry.set('SAVED_MESSAGE_CREATE', handleSavedMessageCreate as GatewayEventHandler);
	registry.set('SAVED_MESSAGE_DELETE', handleSavedMessageDelete as GatewayEventHandler);

	registry.set('PRESENCE_UPDATE', handlePresenceUpdate as GatewayEventHandler);
	registry.set('PRESENCE_UPDATE_BULK', handlePresenceUpdateBulk as GatewayEventHandler);

	registry.set('VOICE_STATE_UPDATE', handleVoiceStateUpdate as GatewayEventHandler);
	registry.set('VOICE_SERVER_UPDATE', handleVoiceServerUpdate as GatewayEventHandler);

	registry.set('CALL_CREATE', handleCallCreate as GatewayEventHandler);
	registry.set('CALL_UPDATE', handleCallUpdate as GatewayEventHandler);
	registry.set('CALL_DELETE', handleCallDelete as GatewayEventHandler);

	registry.set('INVITE_CREATE', handleInviteCreate as GatewayEventHandler);
	registry.set('INVITE_DELETE', handleInviteDelete as GatewayEventHandler);

	registry.set('RELATIONSHIP_ADD', handleRelationshipAdd as GatewayEventHandler);
	registry.set('RELATIONSHIP_UPDATE', handleRelationshipUpdate as GatewayEventHandler);
	registry.set('RELATIONSHIP_REMOVE', handleRelationshipRemove as GatewayEventHandler);

	registry.set('WEBHOOKS_UPDATE', handleWebhooksUpdate as GatewayEventHandler);
	registry.set('FAVORITE_MEME_CREATE', handleFavoriteMemeCreate as GatewayEventHandler);
	registry.set('FAVORITE_MEME_UPDATE', handleFavoriteMemeUpdate as GatewayEventHandler);
	registry.set('FAVORITE_MEME_DELETE', handleFavoriteMemeDelete as GatewayEventHandler);

	registry.set('SESSIONS_REPLACE', () => {});

	return registry;
}
