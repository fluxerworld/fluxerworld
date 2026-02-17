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

import styles from '@app/components/channel/MessageActionBottomSheet.module.css';
import {useMessageActionMenuData} from '@app/components/channel/MessageActionMenu';
import {MessageReactionsSheet} from '@app/components/channel/MessageReactionsSheet';
import {renderQuickReactionEmoji} from '@app/components/channel/QuickReactionsRow';
import quickReactionStyles from '@app/components/channel/QuickReactionsRow.module.css';
import {ExpressionPickerSheet} from '@app/components/modals/ExpressionPickerSheet';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import type {MessageRecord} from '@app/records/MessageRecord';
import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import {useLingui} from '@lingui/react/macro';
import {PlusIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useState} from 'react';

interface MessageActionBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	message: MessageRecord;
	handleDelete: (bypassConfirm?: boolean) => void;
}

export const MessageActionBottomSheet: React.FC<MessageActionBottomSheetProps> = observer(
	({isOpen, onClose, message, handleDelete}) => {
		const {t} = useLingui();
		const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
		const [isReactionsSheetOpen, setIsReactionsSheetOpen] = useState(false);

		const handleAddReaction = useCallback(() => {
			setIsEmojiPickerOpen(true);
		}, []);

		const handleOpenReactionsSheet = useCallback(() => {
			setIsReactionsSheetOpen(true);
		}, []);

		const handleReactionsSheetClose = useCallback(() => {
			setIsReactionsSheetOpen(false);
			onClose();
		}, [onClose]);

		const handleEmojiPickerClose = useCallback(() => {
			setIsEmojiPickerOpen(false);
			onClose();
		}, [onClose]);

		const {groups, handlers, quickReactionEmojis, quickReactionRowVisible} = useMessageActionMenuData(message, {
			onClose,
			onDelete: () => handleDelete(),
			onOpenEmojiPicker: handleAddReaction,
			onOpenReactionsSheet: handleOpenReactionsSheet,
			quickReactionCount: 4,
		});
		const visibleGroups = useMemo(() => groups.filter((group) => group.items.length > 0), [groups]);

		const quickReactionRow = quickReactionRowVisible ? (
			<div className={styles.quickReactionWrapper}>
				<div className={quickReactionStyles.row}>
					{quickReactionEmojis.map((emoji) => (
						<button
							key={emoji.name}
							type="button"
							onClick={() => {
								EmojiPickerStore.trackEmoji(emoji);
								handlers.handleEmojiSelect(emoji);
								onClose();
							}}
							aria-label={t`React with :${emoji.name}:`}
							className={quickReactionStyles.button}
						>
							{renderQuickReactionEmoji(emoji)}
						</button>
					))}

					<button
						type="button"
						onClick={handleAddReaction}
						aria-label={t`Add another reaction`}
						className={quickReactionStyles.button}
					>
						<PlusIcon size={24} weight="bold" />
					</button>
				</div>
			</div>
		) : null;

		return (
			<>
				<MenuBottomSheet
					isOpen={isOpen && !isEmojiPickerOpen && !isReactionsSheetOpen}
					onClose={onClose}
					groups={visibleGroups}
					headerContent={quickReactionRow}
				/>
				<ExpressionPickerSheet
					isOpen={isEmojiPickerOpen}
					onClose={handleEmojiPickerClose}
					channelId={message.channelId}
					onEmojiSelect={handlers.handleEmojiSelect}
					visibleTabs={['emojis']}
				/>
				<MessageReactionsSheet
					isOpen={isReactionsSheetOpen}
					onClose={handleReactionsSheetClose}
					channelId={message.channelId}
					messageId={message.id}
					openToReaction={message.reactions[0]}
				/>
			</>
		);
	},
);
