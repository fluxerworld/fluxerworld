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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ReactionActionCreators from '@app/actions/ReactionActionCreators';
import styles from '@app/components/modals/MessageReactionsModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {MessageReactionsFilters, MessageReactionsReactorsList} from '@app/components/shared/MessageReactionsContent';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {useMessageReactionsState} from '@app/hooks/useMessageReactionsState';
import type {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import type {MessageReaction} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {TrashIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {type MouseEvent, useCallback} from 'react';

export const MessageReactionsModal = observer(
	({channelId, messageId, openToReaction}: {channelId: string; messageId: string; openToReaction: MessageReaction}) => {
		const {t, i18n} = useLingui();
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
			isOpen: true,
			onMissingMessage: () => ModalActionCreators.pop(),
		});

		const handleReactionContextMenu = useCallback(
			(reaction: MessageReaction, event: MouseEvent<HTMLButtonElement>) => {
				if (!canManageMessages) {
					return;
				}
				ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
					<MenuGroup>
						<MenuItem
							icon={<TrashIcon />}
							onClick={() => {
								ReactionActionCreators.removeReactionEmoji(i18n, channelId, messageId, reaction.emoji);
								onClose();
							}}
							danger
						>
							{t`Remove Reaction`}
						</MenuItem>
					</MenuGroup>
				));
			},
			[canManageMessages, channelId, i18n, messageId, t],
		);

		const handleRemoveReactor = useCallback(
			(reactor: UserRecord) => {
				if (!selectedReaction) {
					return;
				}
				const isOwnReaction =
					AuthenticationStore.currentUserId != null && reactor.id === AuthenticationStore.currentUserId;
				ReactionActionCreators.removeReaction(
					i18n,
					channelId,
					messageId,
					selectedReaction.emoji,
					isOwnReaction ? undefined : reactor.id,
				);
			},
			[channelId, i18n, messageId, selectedReaction],
		);

		if (!message || !selectedReaction) {
			return null;
		}

		return (
			<Modal.Root size="medium" className={styles.modalRoot} onClose={() => ModalActionCreators.pop()}>
				<Modal.Header title={<Trans>Reactions</Trans>} />
				<Modal.Content className={styles.modalContent} padding="none">
					<div className={styles.modalLayout}>
						<div className={styles.sidebar}>
							<div className={styles.reactionFiltersPane}>
								<MessageReactionsFilters
									messageId={messageId}
									reactions={reactions}
									selectedReaction={selectedReaction}
									onSelectReaction={setSelectedReaction}
									canManageMessages={canManageMessages}
									variant="modal"
									onReactionContextMenu={handleReactionContextMenu}
								/>
							</div>
						</div>
						<div className={styles.reactionListContainer}>
							<MessageReactionsReactorsList
								channelId={channelId}
								reactors={reactors}
								isLoading={isLoading}
								canManageMessages={canManageMessages}
								currentUserId={AuthenticationStore.currentUserId}
								guildId={guildId}
								scrollerKey={reactorScrollerKey}
								loadingLabel={t`Loading reactions`}
								onRemoveReactor={handleRemoveReactor}
							/>
						</div>
					</div>
				</Modal.Content>
			</Modal.Root>
		);
	},
);
