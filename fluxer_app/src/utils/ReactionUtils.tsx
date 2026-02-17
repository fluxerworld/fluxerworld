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

import i18n from '@app/I18n';
import UnicodeEmojis from '@app/lib/UnicodeEmojis';
import type {MessageRecord} from '@app/records/MessageRecord';
import ChannelStore from '@app/stores/ChannelStore';
import MessageReactionsStore from '@app/stores/MessageReactionsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import type {UnicodeEmoji} from '@app/types/EmojiTypes';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import * as EmojiUtils from '@app/utils/EmojiUtils';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {getSkinTonedSurrogate} from '@app/utils/SkinToneUtils';
import {setUrlQueryParams} from '@app/utils/UrlUtils';
import {msg} from '@lingui/core/macro';

export interface ReactionEmoji {
	id?: string | null;
	name: string;
	animated?: boolean;
	url?: string | null;
}

export function getReactionTooltip(message: MessageRecord, emoji: ReactionEmoji) {
	const channel = ChannelStore.getChannel(message.channelId)!;
	const guildId = channel.guildId;
	const users = MessageReactionsStore.getReactions(message.id, emoji)
		.slice(0, 3)
		.map((user) => NicknameUtils.getNickname(user, guildId));

	if (users.length === 0) {
		return '';
	}

	const reaction = message.getReaction(emoji);
	const othersCount = Math.max(0, (reaction?.count || 0) - users.length);
	const emojiName = getEmojiNameWithColons(emoji);

	if (users.length === 1) {
		if (othersCount > 0) {
			return othersCount === 1
				? i18n._(msg`${emojiName} reacted by ${users[0]} and ${othersCount} other`)
				: i18n._(msg`${emojiName} reacted by ${users[0]} and ${othersCount} others`);
		}
		return i18n._(msg`${emojiName} reacted by ${users[0]}`);
	}

	if (users.length === 2) {
		if (othersCount > 0) {
			return othersCount === 1
				? i18n._(msg`${emojiName} reacted by ${users[0]}, ${users[1]} and ${othersCount} other`)
				: i18n._(msg`${emojiName} reacted by ${users[0]}, ${users[1]} and ${othersCount} others`);
		}
		return i18n._(msg`${emojiName} reacted by ${users[0]} and ${users[1]}`);
	}

	if (users.length === 3) {
		if (othersCount > 0) {
			return othersCount === 1
				? i18n._(msg`${emojiName} reacted by ${users[0]}, ${users[1]}, ${users[2]} and ${othersCount} other`)
				: i18n._(msg`${emojiName} reacted by ${users[0]}, ${users[1]}, ${users[2]} and ${othersCount} others`);
		}
		return i18n._(msg`${emojiName} reacted by ${users[0]}, ${users[1]} and ${users[2]}`);
	}

	return othersCount === 1
		? i18n._(msg`${emojiName} reacted by ${othersCount} other`)
		: i18n._(msg`${emojiName} reacted by ${othersCount} others`);
}

const isCustomEmoji = (emoji: UnicodeEmoji | ReactionEmoji): emoji is ReactionEmoji =>
	'id' in emoji && emoji.id != null;

export function toReactionEmoji(emoji: UnicodeEmoji | ReactionEmoji): ReactionEmoji {
	if (isCustomEmoji(emoji)) {
		return emoji;
	}
	return {name: getSkinTonedSurrogate(emoji)};
}

export function emojiEquals(reactionEmoji: ReactionEmoji, emoji: UnicodeEmoji | ReactionEmoji) {
	return isCustomEmoji(emoji)
		? emoji.id === reactionEmoji.id
		: reactionEmoji.id == null && emoji.name === reactionEmoji.name;
}

export function getReactionKey(messageId: string, emoji: ReactionEmoji) {
	return `${messageId}:${emoji.name}:${emoji.id || ''}`;
}

export function getEmojiName(emoji: ReactionEmoji): string {
	return emoji.id == null ? UnicodeEmojis.getSurrogateName(emoji.name) || emoji.name : `:${emoji.name}:`;
}

export function getEmojiNameWithColons(emoji: ReactionEmoji): string {
	const name = emoji.id == null ? UnicodeEmojis.getSurrogateName(emoji.name) || emoji.name : emoji.name;
	return `:${name}:`;
}

export function useEmojiURL({
	emoji,
	isHovering = false,
	size = 128,
	forceAnimate = false,
}: {
	emoji: ReactionEmoji;
	isHovering?: boolean;
	size?: number;
	forceAnimate?: boolean;
}): string | null {
	const {animateEmoji} = UserSettingsStore;

	const shouldAnimate = forceAnimate || animateEmoji || isHovering;

	if (emoji.id == null) {
		if (shouldUseNativeEmoji) {
			return null;
		}
		return EmojiUtils.getEmojiURL(emoji.name);
	}

	const url = AvatarUtils.getEmojiURL({id: emoji.id, animated: shouldAnimate});
	return setUrlQueryParams(url, {size, quality: 'lossless'});
}
