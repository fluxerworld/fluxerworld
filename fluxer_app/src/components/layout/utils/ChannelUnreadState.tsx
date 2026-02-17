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

export interface ChannelUnreadStateInput {
	unreadCount: number;
	mentionCount: number;
	isMuted: boolean;
	showFadedUnreadOnMutedChannels: boolean;
}

export interface ChannelUnreadState {
	hasUnreadMessages: boolean;
	hasMentions: boolean;
	isHighlight: boolean;
	shouldShowUnreadIndicator: boolean;
	hasVisibleUnread: boolean;
}

export function getChannelUnreadState({
	unreadCount,
	mentionCount,
	isMuted,
	showFadedUnreadOnMutedChannels,
}: ChannelUnreadStateInput): ChannelUnreadState {
	const hasUnreadMessages = unreadCount > 0;
	const hasMentions = mentionCount > 0;
	const shouldShowUnreadIndicator = hasUnreadMessages && (!isMuted || showFadedUnreadOnMutedChannels);

	return {
		hasUnreadMessages,
		hasMentions,
		isHighlight: hasMentions || (hasUnreadMessages && !isMuted),
		shouldShowUnreadIndicator,
		hasVisibleUnread: hasMentions || shouldShowUnreadIndicator,
	};
}
