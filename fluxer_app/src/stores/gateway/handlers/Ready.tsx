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

import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import accountStorage from '@app/lib/AccountStorage';
import {Logger} from '@app/lib/Logger';
import type {FavoriteMeme} from '@app/records/FavoriteMemeRecord';
import type {Relationship} from '@app/records/RelationshipRecord';
import AccountManager from '@app/stores/AccountManager';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import AuthSessionStore from '@app/stores/AuthSessionStore';
import ChannelStore from '@app/stores/ChannelStore';
import CountryCodeStore from '@app/stores/CountryCodeStore';
import EmojiStore from '@app/stores/EmojiStore';
import FavoriteMemeStore from '@app/stores/FavoriteMemeStore';
import GuildAvailabilityStore from '@app/stores/GuildAvailabilityStore';
import GuildListStore from '@app/stores/GuildListStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import GuildStore from '@app/stores/GuildStore';
import GuildVerificationStore from '@app/stores/GuildVerificationStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import InitializationStore from '@app/stores/InitializationStore';
import MemberSearchStore from '@app/stores/MemberSearchStore';
import MemberSidebarStore from '@app/stores/MemberSidebarStore';
import MessageReactionsStore from '@app/stores/MessageReactionsStore';
import MessageStore from '@app/stores/MessageStore';
import PermissionStore from '@app/stores/PermissionStore';
import PresenceStore from '@app/stores/PresenceStore';
import ReadStateStore, {type GatewayReadState} from '@app/stores/ReadStateStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import RtcRegionsStore from '@app/stores/RtcRegionsStore';
import StickerStore from '@app/stores/StickerStore';
import UserGuildSettingsStore, {type GatewayGuildSettings} from '@app/stores/UserGuildSettingsStore';
import UserNoteStore from '@app/stores/UserNoteStore';
import UserPinnedDMStore from '@app/stores/UserPinnedDMStore';
import UserSettingsStore, {type UserSettings} from '@app/stores/UserSettingsStore';
import UserStore from '@app/stores/UserStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {GuildReadyData} from '@app/types/gateway/GatewayGuildTypes';
import type {PresenceRecord} from '@app/types/gateway/GatewayPresenceTypes';
import type {Channel, RtcRegionResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {User, UserPrivate} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

const logger = new Logger('READY Handler');

interface ReadyPayload {
	session_id: string;
	guilds: Array<GuildReadyData>;
	user: UserPrivate;
	private_channels?: Array<Channel>;
	notes?: Record<string, string>;
	country_code?: string;
	pinned_dms?: Array<string>;
	relationships?: Array<Relationship>;
	favorite_memes?: Array<FavoriteMeme>;
	users?: Array<User>;
	user_settings?: UserSettings;
	user_guild_settings?: Array<GatewayGuildSettings>;
	read_states?: Array<GatewayReadState>;
	presences?: Array<PresenceRecord>;
	auth_session_id_hash?: string;
	rtc_regions?: Array<RtcRegionResponse>;
}

export function handleReady(data: ReadyPayload, context: GatewayHandlerContext): void {
	const currentSessionId = data.session_id;
	const isNewSession = context.previousSessionId !== null && context.previousSessionId !== currentSessionId;

	if (isNewSession) {
		logger.info(
			`New session detected (previous: ${context.previousSessionId}, current: ${currentSessionId}), clearing message state`,
		);
		MessageStore.handleSessionInvalidated();
		MemberSidebarStore.handleSessionInvalidated();
	}

	context.setPreviousSessionId(currentSessionId);

	const guilds = data.guilds;
	const channels: Array<Channel> = [];

	if (data.private_channels) {
		for (const channel of data.private_channels) {
			channels.push({...channel});
		}
	}

	for (const guild of guilds) {
		if (guild.unavailable) continue;
		for (const channel of guild.channels) {
			channels.push({...channel, guild_id: guild.id});
		}
	}

	GuildAvailabilityStore.loadUnavailableGuilds(guilds);

	if (data.notes) {
		UserNoteStore.loadNotes(data.notes);
	}
	if (data.country_code) {
		CountryCodeStore.setCountryCode(data.country_code);
	}
	if (data.pinned_dms) {
		UserPinnedDMStore.setPinnedDMs(data.pinned_dms);
	}
	if (data.relationships) {
		RelationshipStore.loadRelationships(data.relationships);
	}
	if (data.favorite_memes) {
		FavoriteMemeStore.loadFavoriteMemes(data.favorite_memes);
	}
	if (data.rtc_regions) {
		RtcRegionsStore.setRegions(data.rtc_regions);
	}

	UserStore.handleConnectionOpen(data.user);
	if (data.users && data.users.length > 0) {
		UserStore.cacheUsers(data.users);
	}

	const user = data.user;
	if (user.id) {
		const userData = {
			username: user.username,
			discriminator: user.discriminator,
			email: user.email ?? undefined,
			avatar: user.avatar ?? undefined,
		};
		void accountStorage.updateAccountUserData(user.id, userData);
		void AccountManager.updateAccountUserData(user.id, userData);
	}

	VoiceSettingsStore.handleConnectionOpen(data.user);
	AuthenticationStore.handleConnectionOpen({user: data.user});
	GuildStore.handleConnectionOpen({guilds});
	UserSettingsStore.handleConnectionOpen(data.user_settings);
	GuildListStore.handleConnectionOpen(guilds);
	GuildMemberStore.handleConnectionOpen(guilds);
	GuildVerificationStore.handleConnectionOpen();
	ChannelStore.handleConnectionOpen({channels});

	if (data.auth_session_id_hash) {
		AuthSessionStore.handleConnectionOpen(data.auth_session_id_hash);
	} else {
		logger.warn('READY missing auth_session_id_hash; continuing without AuthSessionStore init');
	}

	MessageReactionsStore.handleConnectionOpen();
	StickerStore.handleConnectionOpen(guilds);
	EmojiStore.handleConnectionOpen({guilds});
	PermissionStore.handleConnectionOpen();
	MemberSearchStore.handleConnectionOpen();
	UserGuildSettingsStore.handleConnectionOpen(data.user_guild_settings ?? []);
	UserGuildSettingsActionCreators.repairGuildNotificationInheritance();
	ReadStateStore.handleConnectionOpen({
		readState: data.read_states ?? [],
		channels,
	});
	GuildReadStateStore.handleConnectionOpen();
	PresenceStore.handleConnectionOpen(data.user, guilds, data.presences);
	MediaEngineStore.handleConnectionOpen(guilds);
	InitializationStore.setReady(data);

	context.setReady();
	MessageStore.handleConnectionOpen();
}
