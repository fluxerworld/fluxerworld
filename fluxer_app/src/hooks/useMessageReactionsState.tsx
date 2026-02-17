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

import * as ReactionActionCreators from '@app/actions/ReactionActionCreators';
import type {MessageRecord} from '@app/records/MessageRecord';
import type {UserRecord} from '@app/records/UserRecord';
import ChannelStore from '@app/stores/ChannelStore';
import MessageReactionsStore from '@app/stores/MessageReactionsStore';
import MessageStore from '@app/stores/MessageStore';
import PermissionStore from '@app/stores/PermissionStore';
import {emojiEquals, getReactionKey} from '@app/utils/ReactionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {MessageReaction} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useEffect, useMemo, useState} from 'react';

interface UseMessageReactionsStateOptions {
	channelId: string;
	messageId: string;
	openToReaction?: MessageReaction | null;
	isOpen?: boolean;
	onMissingMessage?: () => void;
}

interface MessageReactionsState {
	message: MessageRecord | undefined;
	reactions: ReadonlyArray<MessageReaction>;
	selectedReaction: MessageReaction | null;
	setSelectedReaction: (reaction: MessageReaction) => void;
	reactors: ReadonlyArray<UserRecord>;
	fetchStatus: string;
	isLoading: boolean;
	canManageMessages: boolean;
	guildId?: string;
	reactorScrollerKey: string;
}

export function useMessageReactionsState({
	channelId,
	messageId,
	openToReaction,
	isOpen = true,
	onMissingMessage,
}: UseMessageReactionsStateOptions): MessageReactionsState {
	const [selectedReaction, setSelectedReaction] = useState<MessageReaction | null>(openToReaction ?? null);
	const message = MessageStore.getMessage(channelId, messageId);
	const reactions = message?.reactions ?? [];
	const channel = ChannelStore.getChannel(channelId);
	const guildId = channel?.guildId;
	const canManageMessages = PermissionStore.can(Permissions.MANAGE_MESSAGES, {
		guildId,
		channelId,
	});

	useEffect(() => {
		if (openToReaction) {
			setSelectedReaction(openToReaction);
		}
	}, [openToReaction]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		if (!message || reactions.length === 0) {
			onMissingMessage?.();
			return;
		}

		if (!selectedReaction) {
			setSelectedReaction(reactions[0]);
			return;
		}

		const exists = reactions.some((reaction) => emojiEquals(reaction.emoji, selectedReaction.emoji));
		if (!exists) {
			setSelectedReaction(reactions[0]);
		}
	}, [isOpen, message, onMissingMessage, reactions, selectedReaction]);

	const reactors = selectedReaction ? MessageReactionsStore.getReactions(messageId, selectedReaction.emoji) : [];

	const fetchStatus = selectedReaction
		? MessageReactionsStore.getFetchStatus(messageId, selectedReaction.emoji)
		: 'idle';
	const isLoading = fetchStatus === 'pending';

	const reactorScrollerKey = useMemo(() => {
		if (!message || !selectedReaction) {
			return 'message-reactions-reactor-scroller';
		}
		return `message-reactions-reactor-scroller-${getReactionKey(message.id, selectedReaction.emoji)}`;
	}, [message?.id, selectedReaction]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		if (!selectedReaction || !message) {
			return;
		}
		if (fetchStatus === 'pending' || fetchStatus === 'error') {
			return;
		}

		const reactionOnMessage = message.reactions.find((reaction) => emojiEquals(reaction.emoji, selectedReaction.emoji));
		if (!reactionOnMessage || reactionOnMessage.count === 0) {
			return;
		}

		const desired = Math.min(100, reactionOnMessage.count);
		const shouldFetch =
			fetchStatus === 'idle' || (fetchStatus === 'success' && reactors.length > 0 && reactors.length < desired);
		if (shouldFetch) {
			ReactionActionCreators.getReactions(channelId, messageId, selectedReaction.emoji, 100).catch(() => {});
		}
	}, [channelId, fetchStatus, isOpen, message, messageId, reactors.length, selectedReaction]);

	return {
		message,
		reactions,
		selectedReaction,
		setSelectedReaction,
		reactors,
		fetchStatus,
		isLoading,
		canManageMessages,
		guildId,
		reactorScrollerKey,
	};
}
