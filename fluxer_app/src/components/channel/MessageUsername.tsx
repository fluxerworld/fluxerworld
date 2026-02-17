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

import {useMaybeMessageViewContext} from '@app/components/channel/MessageViewContext';
import {PreloadableUserPopout} from '@app/components/channel/PreloadableUserPopout';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import type {UserRecord} from '@app/records/UserRecord';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import styles from '@app/styles/Message.module.css';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef} from 'react';

export const MessageUsername = observer(
	({
		user,
		message,
		guild,
		member,
		className,
		previewColor,
		previewName,
	}: {
		user: UserRecord;
		message: MessageRecord;
		guild?: GuildRecord;
		member?: GuildMemberRecord;
		className: string;
		isPreview: boolean;
		previewColor?: string;
		previewName?: string;
	}) => {
		const usernameRef = useRef<HTMLSpanElement | null>(null);
		const contextMenuOpen = useContextMenuHoverState(usernameRef);
		const displayName = useMemo(
			() => previewName || NicknameUtils.getNickname(user, guild?.id, message.channelId),
			[previewName, user, guild?.id, message.channelId],
		);
		const color = useMemo(() => previewColor || member?.getColorString(), [previewColor, member]);
		const onPopoutToggle = useMaybeMessageViewContext()?.onPopoutToggle;
		const handlePopoutOpen = useCallback(() => onPopoutToggle?.(true), [onPopoutToggle]);
		const handlePopoutClose = useCallback(() => onPopoutToggle?.(false), [onPopoutToggle]);

		const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				(e.currentTarget as HTMLElement).click();
			}
		}, []);

		return (
			<PreloadableUserPopout
				user={user}
				isWebhook={message.webhookId != null}
				webhookId={message.webhookId ?? undefined}
				guildId={guild?.id}
				channelId={message.channelId}
				enableLongPressActions={false}
				onPopoutOpen={handlePopoutOpen}
				onPopoutClose={handlePopoutClose}
			>
				<FocusRing>
					<span
						className={clsx(className, contextMenuOpen && styles.contextMenuUnderline)}
						style={{color}}
						data-user-id={user.id}
						data-guild-id={guild?.id}
						tabIndex={KeyboardModeStore.keyboardModeEnabled ? 0 : -1}
						role="button"
						ref={usernameRef}
						onKeyDown={handleKeyDown}
					>
						{displayName}
					</span>
				</FocusRing>
			</PreloadableUserPopout>
		);
	},
);
