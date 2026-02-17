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

import {BlockedMessageGroups} from '@app/components/channel/BlockedMessageGroups';
import {Divider} from '@app/components/channel/Divider';
import {MessageGroup} from '@app/components/channel/MessageGroup';
import styles from '@app/components/channel/Messages.module.css';
import type {ChannelMessages} from '@app/lib/ChannelMessages';
import {IS_DEV} from '@app/lib/Env';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import {type ChannelStreamItem, ChannelStreamType} from '@app/utils/MessageGroupingUtils';
import {MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import type React from 'react';

const logger = new Logger('ChannelMessageStream');

const isSystemMessage = (message: MessageRecord | undefined): boolean => {
	if (!message) return false;
	return message.type !== MessageTypes.DEFAULT && message.type !== MessageTypes.REPLY;
};

type MessageGroupKind = 'system' | 'regular';

const getMessageGroupKind = (message: MessageRecord | undefined): MessageGroupKind => {
	return isSystemMessage(message) ? 'system' : 'regular';
};

interface RenderChannelStreamProps {
	channelStream: Array<ChannelStreamItem>;
	messages: ChannelMessages;
	channel: ChannelRecord;
	highlightedMessageId: string | null;
	messageDisplayCompact: boolean;
	messageGroupSpacing: number;
	revealedMessageId: string | null;
	onMessageEdit?: (target: HTMLElement) => void;
	onReveal?: (messageId: string | null) => void;
	messageRowClassName?: string;
	messageActionsClassName?: string;
	renderMessageActions?: (message: MessageRecord) => React.ReactNode;
	readonlyPreview?: boolean;
	dateDividerClassName?: string;
	suppressUnreadIndicator?: boolean;
}

export function renderChannelStream(props: RenderChannelStreamProps): Array<React.ReactNode> {
	const {
		channelStream,
		channel,
		highlightedMessageId,
		messageDisplayCompact,
		messageGroupSpacing,
		revealedMessageId,
		onMessageEdit,
		onReveal,
		messageRowClassName,
		messageActionsClassName,
		renderMessageActions,
		readonlyPreview,
		dateDividerClassName,
		suppressUnreadIndicator,
	} = props;

	const nodes: Array<React.ReactNode> = [];
	const seenKeys = new Map<string, {type: string; index: number; detail: Record<string, unknown>}>();

	const registerKey = (key: string | undefined, type: string, index: number, detail: Record<string, unknown> = {}) => {
		if (!key) return;
		const existing = seenKeys.get(key);
		if (existing) {
			if (IS_DEV) {
				logger.warn('Duplicate channel stream key detected', {
					key,
					existing,
					next: {type, index, detail},
				});
			}
			return;
		}
		seenKeys.set(key, {type, index, detail});
	};

	let pendingMessages: Array<MessageRecord> = [];
	let pendingStreamItems: Array<ChannelStreamItem> = [];
	let pendingGroupId: string | undefined;
	let pendingFlashKey: number | undefined;
	let lastRenderedGroupKind: MessageGroupKind | null = null;
	let spacerCounter = 0;
	let currentIndex = -1;

	const pushSpacerIfNeeded = (nextKind: MessageGroupKind, keyBase: string, nextMessageHasUnreadDivider = false) => {
		if (messageGroupSpacing <= 0 || lastRenderedGroupKind == null) return;
		if (nextMessageHasUnreadDivider) return;

		const bothSystem = lastRenderedGroupKind === 'system' && nextKind === 'system';
		const spacerClass = bothSystem ? styles.groupSpacerHalf : styles.groupSpacer;

		nodes.push(<div key={`group-spacer-${keyBase}-${spacerCounter++}`} className={spacerClass} aria-hidden="true" />);
	};

	const flushPendingGroup = () => {
		if (pendingMessages.length === 0) return;

		const groupKey = pendingGroupId ?? pendingMessages[0].id;
		registerKey(groupKey, 'MessageGroup', currentIndex, {
			groupId: pendingGroupId ?? null,
			firstMessageId: pendingMessages[0]?.id ?? null,
			lastMessageId: pendingMessages[pendingMessages.length - 1]?.id ?? null,
			count: pendingMessages.length,
		});
		const groupKind = getMessageGroupKind(pendingMessages[0]);
		const streamItemsMap = new Map(pendingStreamItems.map((item) => [(item.content as MessageRecord).id, item]));
		const firstMessageHasUnreadDivider = streamItemsMap.get(pendingMessages[0].id)?.showUnreadDividerBefore ?? false;
		pushSpacerIfNeeded(groupKind, groupKey, firstMessageHasUnreadDivider);

		const getUnreadDividerVisibility = (messageId: string, position: 'before' | 'after') => {
			if (suppressUnreadIndicator) {
				return false;
			}
			if (position === 'before') {
				const streamItem = streamItemsMap.get(messageId);
				const visible = streamItem?.showUnreadDividerBefore ?? false;
				return visible;
			}
			return false;
		};

		nodes.push(
			<MessageGroup
				key={groupKey}
				messages={pendingMessages}
				channel={channel}
				onEdit={onMessageEdit}
				highlightedMessageId={highlightedMessageId}
				messageDisplayCompact={messageDisplayCompact}
				flashKey={pendingFlashKey}
				getUnreadDividerVisibility={getUnreadDividerVisibility}
				idPrefix="chat-messages"
				messageRowClassName={messageRowClassName}
				messageActionsClassName={messageActionsClassName}
				renderMessageActions={renderMessageActions}
				readonlyPreview={readonlyPreview}
			/>,
		);

		lastRenderedGroupKind = groupKind;
		pendingMessages = [];
		pendingStreamItems = [];
		pendingGroupId = undefined;
		pendingFlashKey = undefined;
	};

	for (let i = 0; i < channelStream.length; i++) {
		const item = channelStream[i];
		currentIndex = i;

		if (item.type !== ChannelStreamType.MESSAGE) {
			flushPendingGroup();

			if (item.type === ChannelStreamType.DIVIDER) {
				const isUnread = item.unreadId != null && !suppressUnreadIndicator;
				const isDateDivider = !!item.content;
				const dividerSpacing = isDateDivider ? 16 : 0;
				const dividerKey = item.contentKey || `divider-${i}`;
				registerKey(dividerKey, 'Divider', i, {
					contentKey: item.contentKey ?? null,
					unreadId: item.unreadId ?? null,
				});
				nodes.push(
					<Divider
						key={dividerKey}
						spacing={dividerSpacing}
						red={isUnread}
						isDate={isDateDivider}
						id={isUnread ? 'new-messages-bar' : undefined}
						className={dateDividerClassName}
					>
						{item.content as string}
					</Divider>,
				);
				lastRenderedGroupKind = null;
				continue;
			}

			if (item.type === ChannelStreamType.MESSAGE_GROUP_BLOCKED) {
				registerKey(item.key, 'BlockedMessageGroups', i, {
					groupId: item.key ?? null,
					itemCount: Array.isArray(item.content) ? item.content.length : 0,
					revealed: item.key === revealedMessageId,
				});
				pushSpacerIfNeeded('regular', item.key ?? `blocked-${i}`);
				nodes.push(
					<BlockedMessageGroups
						key={item.key}
						revealed={item.key === revealedMessageId}
						messageGroups={item.content as Array<ChannelStreamItem>}
						onReveal={onReveal ?? (() => {})}
						compact={messageDisplayCompact}
						channel={channel}
						messageGroupSpacing={messageGroupSpacing}
					/>,
				);
				lastRenderedGroupKind = 'regular';
				continue;
			}

			continue;
		}

		const message = item.content as MessageRecord;
		const itemGroupId = item.groupId ?? message.id;

		if (pendingGroupId && pendingGroupId !== itemGroupId) {
			flushPendingGroup();
		}

		if (!pendingGroupId) {
			pendingGroupId = itemGroupId;
		}

		pendingMessages.push(message);
		pendingStreamItems.push(item);

		if (item.flashKey != null) {
			pendingFlashKey = item.flashKey;
		}
	}

	flushPendingGroup();

	return nodes;
}
