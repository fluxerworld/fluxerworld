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

import type {ChannelMessages} from '@app/lib/ChannelMessages';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import * as DateUtils from '@app/utils/DateUtils';
import {MessageFlags, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import type {ValueOf} from '@fluxer/constants/src/ValueOf';
import {isSameDay as isSameDayBase} from '@fluxer/date_utils/src/DateComparison';
import {extractTimestamp} from '@fluxer/snowflake/src/SnowflakeUtils';

export const ChannelStreamType = {
	MESSAGE: 'MESSAGE',
	MESSAGE_GROUP_BLOCKED: 'MESSAGE_GROUP_BLOCKED',
	MESSAGE_GROUP_IGNORED: 'MESSAGE_GROUP_IGNORED',
	MESSAGE_GROUP_SPAMMER: 'MESSAGE_GROUP_SPAMMER',
	DIVIDER: 'DIVIDER',
} as const;

export type ChannelStreamType = ValueOf<typeof ChannelStreamType>;

export interface ChannelStreamItem {
	type: ChannelStreamType;
	content: MessageRecord | Array<ChannelStreamItem> | string;
	groupId?: string;
	key?: string;
	flashKey?: number;
	jumpTarget?: boolean;
	hasUnread?: boolean;
	hasJumpTarget?: boolean;
	unreadId?: string;
	contentKey?: string;
	showUnreadDividerBefore?: boolean;
}

export const MESSAGE_GROUP_TIMEOUT = 7 * 60 * 1000;

export function isNewMessageGroup(
	_channel: ChannelRecord | undefined,
	prevMessage: MessageRecord | undefined,
	currentMessage: MessageRecord,
): boolean {
	if (!prevMessage) {
		return true;
	}

	if (currentMessage.type === MessageTypes.REPLY) {
		return true;
	}

	const currentIsDisplaySystem =
		currentMessage.type !== MessageTypes.DEFAULT && currentMessage.type !== MessageTypes.REPLY;
	const prevIsDisplaySystem = prevMessage.type !== MessageTypes.DEFAULT && prevMessage.type !== MessageTypes.REPLY;
	if (currentIsDisplaySystem !== prevIsDisplaySystem) {
		return true;
	}

	const isCurrentUserContent = currentMessage.isUserMessage();
	const isPrevUserContent = prevMessage.isUserMessage();

	const bothDisplaySystem = currentIsDisplaySystem && prevIsDisplaySystem;
	if (!bothDisplaySystem && currentMessage.type !== prevMessage.type && !(isCurrentUserContent && isPrevUserContent)) {
		return true;
	}

	if (prevMessage.type <= MessageTypes.REPLY && prevMessage.author.id !== currentMessage.author.id) {
		return true;
	}

	if (currentMessage.webhookId && prevMessage.author.username !== currentMessage.author.username) {
		return true;
	}

	if (!prevMessage.timestamp || !currentMessage.timestamp) {
		return true;
	}

	if (!isSameDayBase(prevMessage.timestamp, currentMessage.timestamp)) {
		return true;
	}

	const timeDiff = currentMessage.timestamp.getTime() - prevMessage.timestamp.getTime();
	if (timeDiff > MESSAGE_GROUP_TIMEOUT) {
		return true;
	}

	const prevSuppressed = prevMessage.hasFlag(MessageFlags.SUPPRESS_NOTIFICATIONS);
	const currSuppressed = currentMessage.hasFlag(MessageFlags.SUPPRESS_NOTIFICATIONS);

	if (currSuppressed !== prevSuppressed) {
		if (!prevSuppressed && currSuppressed) {
			return true;
		}

		if (prevSuppressed && !currSuppressed) {
			const hasMentions =
				currentMessage.mentions.length > 0 || currentMessage.mentionRoles.length > 0 || currentMessage.mentionEveryone;
			if (hasMentions) {
				return true;
			}
		}
	}

	return false;
}

export function getCollapsedGroupType(
	_channel: ChannelRecord,
	message: MessageRecord,
	_treatSpam: boolean,
): ChannelStreamType | null {
	if (message.blocked) {
		return ChannelStreamType.MESSAGE_GROUP_BLOCKED;
	}
	return null;
}

export function createChannelStream(props: {
	channel: ChannelRecord;
	messages: ChannelMessages;
	oldestUnreadMessageId: string | null;
	treatSpam: boolean;
}): Array<ChannelStreamItem> {
	const {channel, messages, oldestUnreadMessageId, treatSpam} = props;

	const stream: Array<ChannelStreamItem> = [];
	let lastDateDivider: string | undefined;
	let groupId: string | undefined;
	let lastMessageInGroup: MessageRecord | undefined;

	let unreadTimestamp: number | null = oldestUnreadMessageId ? extractTimestamp(oldestUnreadMessageId) : null;

	messages.forEach((message): boolean | undefined => {
		const dateString = DateUtils.getFormattedFullDate(message.timestamp);
		if (dateString !== lastDateDivider) {
			stream.push({
				type: ChannelStreamType.DIVIDER,
				content: dateString,
				contentKey: dateString,
			});
			lastDateDivider = dateString;
		}

		const lastItem = stream[stream.length - 1];
		const previousWasCollapsedGroup =
			lastItem?.type === ChannelStreamType.MESSAGE_GROUP_BLOCKED ||
			lastItem?.type === ChannelStreamType.MESSAGE_GROUP_IGNORED ||
			lastItem?.type === ChannelStreamType.MESSAGE_GROUP_SPAMMER;
		let collapsedGroupItem: ChannelStreamItem | null = null;
		let lastInCollapsedGroup: ChannelStreamItem | undefined;

		const collapsedType = getCollapsedGroupType(channel, message, treatSpam);

		if (collapsedType !== null) {
			if (lastItem?.type !== collapsedType) {
				collapsedGroupItem = {
					type: collapsedType,
					content: [],
					key: message.id,
				};
				stream.push(collapsedGroupItem);
			} else {
				collapsedGroupItem = lastItem;
				const collapsedContent = collapsedGroupItem.content as Array<ChannelStreamItem>;
				lastInCollapsedGroup = collapsedContent[collapsedContent.length - 1];
			}
		}

		let shouldShowUnreadDividerBefore = false;

		if (oldestUnreadMessageId === message.id && unreadTimestamp != null) {
			if (lastItem?.type === ChannelStreamType.DIVIDER) {
				lastItem.unreadId = message.id;
			} else {
				shouldShowUnreadDividerBefore = true;
				if (collapsedGroupItem !== null) {
					collapsedGroupItem.hasUnread = true;
				}
			}
			unreadTimestamp = null;
		} else if (unreadTimestamp != null && extractTimestamp(message.id) > unreadTimestamp) {
			shouldShowUnreadDividerBefore = true;
			unreadTimestamp = null;
		}

		let prevMessageForGrouping: MessageRecord | undefined;

		if (collapsedGroupItem && lastInCollapsedGroup && lastInCollapsedGroup.type === ChannelStreamType.MESSAGE) {
			prevMessageForGrouping = lastInCollapsedGroup.content as MessageRecord;
		} else if (previousWasCollapsedGroup && collapsedGroupItem == null) {
			prevMessageForGrouping = undefined;
		} else if (lastItem?.type === ChannelStreamType.MESSAGE) {
			prevMessageForGrouping = lastMessageInGroup ?? (lastItem.content as MessageRecord);
		} else {
			prevMessageForGrouping = lastMessageInGroup;
		}

		const shouldStartNewGroup = isNewMessageGroup(channel, prevMessageForGrouping, message);

		if (shouldStartNewGroup) {
			groupId = message.id;
		}

		const messageItem: ChannelStreamItem = {
			type: ChannelStreamType.MESSAGE,
			content: message,
			groupId,
			showUnreadDividerBefore: shouldShowUnreadDividerBefore,
		};

		if (groupId === message.id) {
			lastMessageInGroup = message;
		}

		const {jumpSequenceId, jumpFlash, jumpTargetId} = messages;

		if (jumpFlash && message.id === jumpTargetId && jumpSequenceId != null) {
			messageItem.flashKey = jumpSequenceId;
		}

		if (messages.jumpTargetId === message.id) {
			messageItem.jumpTarget = true;
		}

		if (collapsedGroupItem !== null) {
			(collapsedGroupItem.content as Array<ChannelStreamItem>).push(messageItem);
			if (messageItem.jumpTarget) {
				collapsedGroupItem.hasJumpTarget = true;
			}
		} else {
			stream.push(messageItem);
		}
		return undefined;
	});

	return stream;
}
