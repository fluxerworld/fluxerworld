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

import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserStore from '@app/stores/UserStore';
import {ChannelTypes, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {GuildMemberData} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {UserPartial} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {beforeEach, describe, expect, test} from 'vitest';

const GUILD_ID = '100000000000000001';
const CHANNEL_ID = '100000000000000002';
const CURRENT_USER_ID = '100000000000000003';
const AUTHOR_ID = '100000000000000004';
const MENTIONED_ROLE_ID = '100000000000000005';
const OTHER_ROLE_ID = '100000000000000006';

function createUser(id: string, username: string): UserPartial {
	return {
		id,
		username,
		discriminator: '0001',
		global_name: username,
		avatar: null,
		avatar_color: null,
		flags: 0,
	};
}

function createGuildMember(userId: string, roles: Array<string>): GuildMemberData {
	return {
		user: createUser(userId, 'Member'),
		nick: null,
		avatar: null,
		banner: null,
		accent_color: null,
		roles,
		joined_at: '2026-02-01T00:00:00.000Z',
		mute: false,
		deaf: false,
		communication_disabled_until: null,
		profile_flags: 0,
	};
}

function createGuildChannel(): Channel {
	return {
		id: CHANNEL_ID,
		guild_id: GUILD_ID,
		name: 'general',
		type: ChannelTypes.GUILD_TEXT,
		last_message_id: null,
		last_pin_timestamp: null,
	};
}

function createIncomingMessage(mentionRoles: Array<string>): Message {
	return {
		id: '100000000000000099',
		channel_id: CHANNEL_ID,
		guild_id: GUILD_ID,
		author: createUser(AUTHOR_ID, 'Author'),
		type: MessageTypes.DEFAULT,
		flags: 0,
		pinned: false,
		mention_everyone: false,
		content: 'hello',
		timestamp: '2026-02-01T00:00:00.000Z',
		mentions: [],
		mention_roles: mentionRoles,
		attachments: [],
		embeds: [],
		reactions: [],
		stickers: [],
	};
}

describe('ReadStateStore role mention detection', () => {
	beforeEach(() => {
		ReadStateStore.clearAll();
		GuildMemberStore.handleConnectionOpen([]);
		UserGuildSettingsStore.handleConnectionOpen([]);
		RelationshipStore.loadRelationships([]);
		AuthenticationStore.setUserId(CURRENT_USER_ID);
		UserStore.cacheUsers([createUser(CURRENT_USER_ID, 'CurrentUser'), createUser(AUTHOR_ID, 'Author')]);
		ChannelStore.handleConnectionOpen({channels: [createGuildChannel()]});
	});

	test('does not treat unrelated role mentions as personal mentions', () => {
		const state = ReadStateStore.get(CHANNEL_ID);
		const message = createIncomingMessage([OTHER_ROLE_ID]);

		expect(state.shouldMentionFor(message, CURRENT_USER_ID, false)).toBe(false);
	});

	test('treats matching role mentions as personal mentions', () => {
		GuildMemberStore.handleMemberAdd(GUILD_ID, createGuildMember(CURRENT_USER_ID, [MENTIONED_ROLE_ID]));
		const state = ReadStateStore.get(CHANNEL_ID);
		const message = createIncomingMessage([MENTIONED_ROLE_ID]);

		expect(state.shouldMentionFor(message, CURRENT_USER_ID, false)).toBe(true);
	});
});
