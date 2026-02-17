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

import styles from '@app/components/channel/ChannelChatLayout.module.css';
import {SlowmodeIndicator} from '@app/components/channel/SlowmodeIndicator';
import {TypingUsers} from '@app/components/channel/TypingUsers';
import {useSlowmode} from '@app/hooks/useSlowmode';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import MessageEditMobileStore from '@app/stores/MessageEditMobileStore';
import MessageReplyStore from '@app/stores/MessageReplyStore';
import MessageStore from '@app/stores/MessageStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface ChannelChatLayoutProps {
	channel: ChannelRecord;
	messages: React.ReactNode;
	textarea: React.ReactNode;
	hideSlowmodeIndicator?: boolean;
}

export const ChannelChatLayout = observer(
	({channel, messages, textarea, hideSlowmodeIndicator}: ChannelChatLayoutProps) => {
		const {slowmodeRemaining, isSlowmodeEnabled, isSlowmodeImmune} = useSlowmode(channel);
		const hasSlowmodeIndicator =
			!hideSlowmodeIndicator && isSlowmodeEnabled && (slowmodeRemaining > 0 || isSlowmodeImmune);

		const replyingMessage = MessageReplyStore.getReplyingMessage(channel.id);
		const referencedMessage = replyingMessage ? MessageStore.getMessage(channel.id, replyingMessage.messageId) : null;
		const editingMobileMessageId = MessageEditMobileStore.getEditingMobileMessageId(channel.id);
		const editingMessage = editingMobileMessageId ? MessageStore.getMessage(channel.id, editingMobileMessageId) : null;
		const hasTopBar = Boolean(referencedMessage || (editingMessage && MobileLayoutStore.enabled));

		return (
			<div className={styles.container}>
				<div className={styles.messagesArea}>{messages}</div>
				<div className={clsx(styles.typingArea, hasTopBar && styles.typingAreaWithTopBar)}>
					<div className={styles.typingContent}>
						<div className={styles.typingLeft}>
							<TypingUsers channel={channel} />
						</div>
						{hasSlowmodeIndicator && (
							<div className={styles.typingRight}>
								<SlowmodeIndicator slowmodeRemaining={slowmodeRemaining} isImmune={isSlowmodeImmune} />
							</div>
						)}
					</div>
				</div>
				<div className={styles.textareaArea}>{textarea}</div>
			</div>
		);
	},
);
