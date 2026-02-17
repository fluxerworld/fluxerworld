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

import {Message} from '@app/components/channel/Message';
import {UnreadDividerSlot} from '@app/components/channel/UnreadDividerSlot';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {Fragment, useMemo} from 'react';

interface MessageGroupProps {
	messages: Array<MessageRecord>;
	channel: ChannelRecord;
	onEdit?: (targetNode: HTMLElement) => void;
	jumpSequenceId?: number;
	highlightedMessageId?: string | null;
	messageDisplayCompact?: boolean;
	flashKey?: number;
	getUnreadDividerVisibility?: (messageId: string, position: 'before' | 'after') => boolean;
	idPrefix?: string;
	messageRowClassName?: string;
	messageActionsClassName?: string;
	renderMessageActions?: (message: MessageRecord) => React.ReactNode;
	readonlyPreview?: boolean;
}

export const MessageGroup: React.FC<MessageGroupProps> = observer((props) => {
	const {t} = useLingui();
	const {
		messages,
		channel,
		onEdit,
		jumpSequenceId,
		highlightedMessageId,
		messageDisplayCompact = false,
		getUnreadDividerVisibility,
		idPrefix,
		messageRowClassName,
		messageActionsClassName,
		renderMessageActions,
		readonlyPreview,
	} = props;

	const groupId = useMemo(() => messages[0]?.id, [messages]);

	const behaviorOverrides = useMemo(
		() =>
			readonlyPreview
				? {
						disableContextMenu: true,
						prefersReducedMotion: true,
					}
				: undefined,
		[readonlyPreview],
	);

	const renderedMessages = useMemo(
		() =>
			messages.map((message, index) => {
				const prevMessage = messages[index - 1];
				const isGroupStart = index === 0;

				return (
					<Fragment key={message.id}>
						{getUnreadDividerVisibility && (
							<UnreadDividerSlot beforeId={message.id} visible={getUnreadDividerVisibility(message.id, 'before')} />
						)}

						<div
							data-message-index={index}
							data-message-id={message.id}
							data-is-group-start={isGroupStart}
							className={messageRowClassName}
						>
							<Message
								channel={channel}
								message={message}
								prevMessage={prevMessage}
								onEdit={onEdit}
								shouldGroup={!isGroupStart}
								isJumpTarget={highlightedMessageId === message.id}
								compact={messageDisplayCompact}
								idPrefix={idPrefix}
								behaviorOverrides={behaviorOverrides}
								readonlyPreview={readonlyPreview}
							/>
							{renderMessageActions && <div className={messageActionsClassName}>{renderMessageActions(message)}</div>}
						</div>
					</Fragment>
				);
			}),
		[
			messages,
			channel,
			onEdit,
			highlightedMessageId,
			messageDisplayCompact,
			idPrefix,
			getUnreadDividerVisibility,
			messageRowClassName,
			messageActionsClassName,
			renderMessageActions,
			behaviorOverrides,
			readonlyPreview,
		],
	);

	return (
		<div data-jump-sequence-id={jumpSequenceId} data-group-id={groupId} role="group" aria-label={t`Message group`}>
			{renderedMessages}
		</div>
	);
});
