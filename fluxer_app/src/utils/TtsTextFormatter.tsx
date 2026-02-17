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
import GuildStore from '@app/stores/GuildStore';
import UserStore from '@app/stores/UserStore';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const USER_MENTION_PATTERN = /<@!?(\d+)>/g;
const ROLE_MENTION_PATTERN = /<@&(\d+)>/g;
const CHANNEL_MENTION_PATTERN = /<#(\d+)>/g;
const CUSTOM_EMOJI_PATTERN = /<a?:([^:]+):\d+>/g;
const SPOILER_PATTERN = /\|\|[^|]+\|\|/g;
const SLASH_COMMAND_PATTERN = /<\/([^:]+):\d+>/g;
const TIMESTAMP_PATTERN = /<t:(\d+)(?::([tTdDfFR]))?>/g;
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`([^`\n]+)`/g;
const MASKED_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;
const BOLD_ITALIC_PATTERN = /\*{3}(.+?)\*{3}/g;
const BOLD_PATTERN = /\*{2}(.+?)\*{2}/g;
const UNDERLINE_PATTERN = /__(.+?)__/g;
const STRIKETHROUGH_PATTERN = /~~(.+?)~~/g;
const ITALIC_PATTERN = /\*(.+?)\*/g;
const BLOCKQUOTE_PATTERN = /^>\s?/gm;
const HEADER_PATTERN = /^(?:-#|#{1,3})\s+/gm;

function formatUserMention(userId: string, guildId: string | null, i18n: I18n): string {
	const user = UserStore.getUser(userId);
	if (!user) {
		return i18n._(msg`unknown user`);
	}

	return NicknameUtils.getNickname(user, guildId ?? undefined);
}

function formatRoleMention(roleId: string, guildId: string | null, i18n: I18n): string {
	if (!guildId) {
		return i18n._(msg`unknown role`);
	}

	const guild = GuildStore.getGuild(guildId);
	if (!guild) {
		return i18n._(msg`unknown role`);
	}

	const role = guild.roles[roleId];
	return role?.name ?? i18n._(msg`unknown role`);
}

function formatChannelMention(channelId: string, i18n: I18n): string {
	const channel = ChannelStore.getChannel(channelId);
	return channel?.name ?? i18n._(msg`unknown channel`);
}

function formatTimestampForTts(timestamp: number, style: string | undefined): string {
	const date = new Date(timestamp * 1000);

	switch (style) {
		case 't':
			return date.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
		case 'T':
			return date.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit', second: '2-digit'});
		case 'd':
			return date.toLocaleDateString(undefined, {day: 'numeric', month: 'numeric', year: 'numeric'});
		case 'D':
			return date.toLocaleDateString(undefined, {day: 'numeric', month: 'long', year: 'numeric'});
		case 'f':
			return date.toLocaleString(undefined, {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
			});
		case 'F':
			return date.toLocaleString(undefined, {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
			});
		default:
			return date.toLocaleString(undefined, {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
			});
	}
}

export function formatMessageForTts(
	content: string,
	authorName: string,
	guildId: string | null,
	i18n: I18n,
	replyAuthorName?: string | null,
): string {
	let formatted = content;

	formatted = formatted.replace(CODE_BLOCK_PATTERN, ` ${i18n._(msg`code block`)} `);

	formatted = formatted.replace(SPOILER_PATTERN, i18n._(msg`spoiler`));

	formatted = formatted.replace(USER_MENTION_PATTERN, (_match, userId) => formatUserMention(userId, guildId, i18n));

	formatted = formatted.replace(ROLE_MENTION_PATTERN, (_match, roleId) => formatRoleMention(roleId, guildId, i18n));

	formatted = formatted.replace(CHANNEL_MENTION_PATTERN, (_match, channelId) => formatChannelMention(channelId, i18n));

	formatted = formatted.replace(CUSTOM_EMOJI_PATTERN, (_match, emojiName) => i18n._(msg`emoji ${emojiName}`));

	formatted = formatted.replace(SLASH_COMMAND_PATTERN, (_match, commandName) => i18n._(msg`slash ${commandName}`));

	formatted = formatted.replace(TIMESTAMP_PATTERN, (_match, timestamp, style) =>
		formatTimestampForTts(Number.parseInt(timestamp, 10), style),
	);

	formatted = formatted.replace(INLINE_CODE_PATTERN, '$1');
	formatted = formatted.replace(MASKED_LINK_PATTERN, '$1');
	formatted = formatted.replace(BOLD_ITALIC_PATTERN, '$1');
	formatted = formatted.replace(BOLD_PATTERN, '$1');
	formatted = formatted.replace(UNDERLINE_PATTERN, '$1');
	formatted = formatted.replace(STRIKETHROUGH_PATTERN, '$1');
	formatted = formatted.replace(ITALIC_PATTERN, '$1');
	formatted = formatted.replace(BLOCKQUOTE_PATTERN, '');
	formatted = formatted.replace(HEADER_PATTERN, '');

	formatted = formatted.replace(/\s+/g, ' ').trim();

	if (replyAuthorName) {
		return i18n._(msg`Replying to ${replyAuthorName}, ${authorName} said: ${formatted}`);
	}

	return i18n._(msg`${authorName} said: ${formatted}`);
}
