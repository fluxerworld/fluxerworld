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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ReactionActionCreators from '@app/actions/ReactionActionCreators';
import styles from '@app/components/channel/MessageReactionsSheet.module.css';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {MessageReactionsFilters, MessageReactionsReactorsList} from '@app/components/shared/MessageReactionsContent';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import {
	MenuBottomSheet,
	type MenuGroupType,
	type MenuItemType,
} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {useMessageReactionsState} from '@app/hooks/useMessageReactionsState';
import type {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import {getEmojiNameWithColons} from '@app/utils/ReactionUtils';
import type {MessageReaction} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {TrashIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useState} from 'react';

interface MessageReactionsSheetProps {
	isOpen: boolean;
	onClose: () => void;
	channelId: string;
	messageId: string;
	openToReaction?: MessageReaction;
}

export const MessageReactionsSheet = observer(
	({isOpen, onClose, channelId, messageId, openToReaction}: MessageReactionsSheetProps) => {
		const {t, i18n} = useLingui();
		const [reactionMenuTarget, setReactionMenuTarget] = useState<MessageReaction | null>(null);

		const {
			message,
			reactions,
			selectedReaction,
			setSelectedReaction,
			reactors,
			isLoading,
			canManageMessages,
			guildId,
			reactorScrollerKey,
		} = useMessageReactionsState({
			channelId,
			messageId,
			openToReaction,
			isOpen,
			onMissingMessage: onClose,
		});

		useEffect(() => {
			if (!isOpen) {
				setReactionMenuTarget(null);
			}
		}, [isOpen]);

		const closeReactionMenu = useCallback(() => {
			setReactionMenuTarget(null);
		}, []);

		const handleReactionLongPress = useCallback((reaction: MessageReaction) => {
			setReactionMenuTarget(reaction);
		}, []);

		const handleRemoveReactionEmoji = useCallback(
			(reaction: MessageReaction) => {
				setReactionMenuTarget(null);
				ModalActionCreators.push(
					modal(() => (
						<ConfirmModal
							title={t`Remove Reaction`}
							description={t`Remove all ${getEmojiNameWithColons(reaction.emoji)} reactions from this message?`}
							primaryText={t`Remove`}
							onPrimary={() => ReactionActionCreators.removeReactionEmoji(i18n, channelId, messageId, reaction.emoji)}
						/>
					)),
				);
			},
			[channelId, i18n, messageId, t],
		);

		const handleRemoveReactor = useCallback(
			(reactor: UserRecord) => {
				if (!selectedReaction) {
					return;
				}
				const isOwnReaction =
					AuthenticationStore.currentUserId != null && reactor.id === AuthenticationStore.currentUserId;
				ModalActionCreators.push(
					modal(() => (
						<ConfirmModal
							title={t`Remove Reaction`}
							description={t`Remove ${getEmojiNameWithColons(selectedReaction.emoji)} reaction from ${reactor.displayName}?`}
							primaryText={t`Remove`}
							onPrimary={() =>
								ReactionActionCreators.removeReaction(
									i18n,
									channelId,
									messageId,
									selectedReaction.emoji,
									isOwnReaction ? undefined : reactor.id,
								)
							}
						/>
					)),
				);
			},
			[channelId, i18n, messageId, selectedReaction, t],
		);

		const reactionMenuGroups = useMemo<Array<MenuGroupType>>(() => {
			if (!reactionMenuTarget || !canManageMessages) {
				return [];
			}

			const item: MenuItemType = {
				icon: <TrashIcon size={20} />,
				label: t`Remove Reaction`,
				onClick: () => handleRemoveReactionEmoji(reactionMenuTarget),
				danger: true,
			};

			return [{items: [item]}];
		}, [canManageMessages, handleRemoveReactionEmoji, reactionMenuTarget, t]);

		if (!message || !selectedReaction) {
			return null;
		}

		const selectedReactionName = getEmojiNameWithColons(selectedReaction.emoji);
		const reactorCountLabel =
			selectedReaction.count === 1 ? t`${selectedReaction.count} reactor` : t`${selectedReaction.count} reactors`;

		return (
			<>
				<BottomSheet
					isOpen={isOpen}
					onClose={onClose}
					title={t`Reactions`}
					initialSnap={2}
					snapPoints={[0, 0.4, 0.75, 1]}
				>
					<div className={styles.sheetBody}>
						<div className={styles.filterContainer}>
							<MessageReactionsFilters
								messageId={messageId}
								reactions={reactions}
								selectedReaction={selectedReaction}
								onSelectReaction={setSelectedReaction}
								canManageMessages={canManageMessages}
								variant="sheet"
								onReactionLongPress={canManageMessages ? handleReactionLongPress : undefined}
							/>
						</div>
						<div className={styles.listHeader}>
							<span>{selectedReactionName}</span>
							<span className={styles.countBadge}>{reactorCountLabel}</span>
						</div>
						<MessageReactionsReactorsList
							channelId={channelId}
							reactors={reactors}
							isLoading={isLoading}
							canManageMessages={canManageMessages}
							currentUserId={AuthenticationStore.currentUserId}
							guildId={guildId}
							scrollerKey={reactorScrollerKey}
							emptyLabel={t`No reactors for this reaction yet.`}
							loadingLabel={t`Loading reactions`}
							showLoadingLabel={true}
							onRemoveReactor={handleRemoveReactor}
						/>
					</div>
				</BottomSheet>
				<MenuBottomSheet
					isOpen={Boolean(reactionMenuTarget)}
					onClose={closeReactionMenu}
					groups={reactionMenuGroups}
					showCloseButton={true}
				/>
			</>
		);
	},
);
