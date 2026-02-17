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
import {ReactionInteractionDisabledModal} from '@app/components/alerts/ReactionInteractionDisabledModal';
import {EmojiInfoBottomSheet} from '@app/components/bottomsheets/EmojiInfoBottomSheet';
import {
	createMessageActionHandlers,
	isClientSystemMessage,
	useMessagePermissions,
} from '@app/components/channel/MessageActionUtils';
import styles from '@app/components/channel/MessageReactions.module.css';
import {LongPressable} from '@app/components/LongPressable';
import {ExpressionPickerSheet} from '@app/components/modals/ExpressionPickerSheet';
import {EmojiPickerPopout} from '@app/components/popouts/EmojiPickerPopout';
import {ReactionTooltip} from '@app/components/popouts/ReactionTooltip';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Popout} from '@app/components/uikit/popout/Popout';
import {useHover} from '@app/hooks/useHover';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {getEmojiName, getReactionKey, useEmojiURL} from '@app/utils/ReactionUtils';
import type {MessageReaction} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {SmileyIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef, useState} from 'react';

interface EmojiInfoData {
	id?: string;
	name: string;
	animated?: boolean;
}

const MessageReactionItem = observer(
	({
		message,
		reaction,
		isPreview = false,
		disableInteraction = false,
	}: {
		message: MessageRecord;
		reaction: MessageReaction;
		isPreview?: boolean;
		disableInteraction?: boolean;
	}) => {
		const {t, i18n} = useLingui();
		const [hoverRef, isHovering] = useHover();
		const [prevCount, setPrevCount] = useState(reaction.count);
		const [animationSyncKey, setAnimationSyncKey] = useState(0);
		const [emojiInfoOpen, setEmojiInfoOpen] = useState(false);
		const [selectedEmoji, setSelectedEmoji] = useState<EmojiInfoData | null>(null);
		const [tooltipHovering, setTooltipHovering] = useState(false);
		const isMobile = MobileLayoutStore.isMobileLayout();

		const handleTooltipAnimationSync = useCallback(() => {
			setAnimationSyncKey((prev) => prev + 1);
		}, []);

		useEffect(() => {
			if (prevCount !== reaction.count) {
				setPrevCount(reaction.count);
			}
		}, [reaction.count, prevCount]);

		const handleClick = () => {
			if (disableInteraction) {
				return;
			}

			if (isPreview) {
				ModalActionCreators.push(modal(() => <ReactionInteractionDisabledModal />));
				return;
			}

			if (reaction.me) {
				ReactionActionCreators.removeReaction(i18n, message.channelId, message.id, reaction.emoji);
			} else {
				ReactionActionCreators.addReaction(i18n, message.channelId, message.id, reaction.emoji);
			}
		};

		const handleLongPress = () => {
			if (isPreview || disableInteraction) {
				return;
			}
			setSelectedEmoji({
				id: reaction.emoji.id ?? undefined,
				name: reaction.emoji.name,
				animated: reaction.emoji.animated,
			});
			setEmojiInfoOpen(true);
		};

		const handleCloseEmojiInfo = useCallback(() => {
			setEmojiInfoOpen(false);
			setSelectedEmoji(null);
		}, []);

		const emojiName = getEmojiName(reaction.emoji);
		const emojiUrl = useEmojiURL({emoji: reaction.emoji, isHovering: isHovering || tooltipHovering});
		const isUnicodeEmoji = reaction.emoji.id == null;

		const variants = {
			up: {y: -20, opacity: 0},
			down: {y: 20, opacity: 0},
			center: {y: 0, opacity: 1},
		};

		const reactionCountText = reaction.count === 1 ? t`${reaction.count} reaction` : t`${reaction.count} reactions`;
		const actionText = reaction.me ? t`press to remove reaction` : t`press to add reaction`;
		const ariaLabel = t`${emojiName}: ${reactionCountText}, ${actionText}`;

		const buttonContent = (
			<FocusRing offset={-2}>
				<button
					type="button"
					className={styles.reactionButton}
					aria-label={ariaLabel}
					aria-pressed={reaction.me}
					disabled={disableInteraction}
					onClick={handleClick}
				>
					<div className={styles.reactionInner}>
						{emojiUrl ? (
							<img src={emojiUrl} alt={emojiName} draggable={false} className={clsx('emoji', styles.emoji)} />
						) : isUnicodeEmoji ? (
							<span className={clsx('emoji', styles.emoji)}>{reaction.emoji.name}</span>
						) : null}
						<div className={styles.countWrapper}>
							<AnimatePresence initial={false}>
								<motion.div
									key={reaction.count}
									initial={reaction.count > prevCount ? 'up' : 'down'}
									animate="center"
									exit={reaction.count > prevCount ? 'down' : 'up'}
									variants={variants}
									transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2}}
								>
									{reaction.count}
								</motion.div>
							</AnimatePresence>
						</div>
					</div>
				</button>
			</FocusRing>
		);

		if (isMobile) {
			return (
				<LongPressable
					className={clsx(styles.reactionContainer, reaction.me && styles.reactionMe)}
					onLongPress={handleLongPress}
				>
					{buttonContent}
					<EmojiInfoBottomSheet isOpen={emojiInfoOpen} onClose={handleCloseEmojiInfo} emoji={selectedEmoji} />
				</LongPressable>
			);
		}

		return (
			<ReactionTooltip
				message={message}
				reaction={reaction}
				hoveredEmojiUrl={emojiUrl}
				animationSyncKey={animationSyncKey}
				onRequestAnimationSync={handleTooltipAnimationSync}
				onTooltipHoverChange={setTooltipHovering}
			>
				<div className={clsx(styles.reactionContainer, reaction.me && styles.reactionMe)} ref={hoverRef}>
					{buttonContent}
				</div>
			</ReactionTooltip>
		);
	},
);

export const MessageReactions = observer(
	({
		message,
		isPreview = false,
		onPopoutToggle,
	}: {
		message: MessageRecord;
		isPreview?: boolean;
		onPopoutToggle?: (isOpen: boolean) => void;
	}) => {
		const {t, i18n} = useLingui();
		const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
		const addReactionButtonRef = useRef<HTMLButtonElement>(null);
		const permissions = useMessagePermissions(message);
		const handlers = createMessageActionHandlers(message, {i18n});
		const keyboardModeEnabled = KeyboardModeStore.keyboardModeEnabled;
		const isMobileLayout = MobileLayoutStore.isMobileLayout();
		const disableReactionInteraction = isClientSystemMessage(message);

		const blurReactionTrigger = useCallback(() => {
			if (keyboardModeEnabled) {
				return;
			}
			requestAnimationFrame(() => addReactionButtonRef.current?.blur());
		}, [keyboardModeEnabled]);

		const handleEmojiPickerToggle = useCallback(
			(open: boolean) => {
				setEmojiPickerOpen(open);
				onPopoutToggle?.(open);
				if (!open) {
					blurReactionTrigger();
				}
			},
			[onPopoutToggle, blurReactionTrigger],
		);

		const handleEmojiPickerOpen = useCallback(() => handleEmojiPickerToggle(true), [handleEmojiPickerToggle]);
		const handleEmojiPickerClose = useCallback(() => handleEmojiPickerToggle(false), [handleEmojiPickerToggle]);

		useEffect(() => {
			return () => {
				if (emojiPickerOpen) {
					onPopoutToggle?.(false);
				}
			};
		}, [emojiPickerOpen, onPopoutToggle]);

		const hasReactions = message.reactions.length > 0;

		return (
			<div className={styles.reactionsGrid}>
				{message.reactions.map((reaction) => (
					<MessageReactionItem
						key={getReactionKey(message.id, reaction.emoji)}
						message={message}
						reaction={reaction}
						isPreview={isPreview}
						disableInteraction={disableReactionInteraction}
					/>
				))}
				{hasReactions &&
					permissions?.canAddReactions &&
					!disableReactionInteraction &&
					!isPreview &&
					(isMobileLayout ? (
						<>
							<FocusRing offset={-2}>
								<button
									ref={addReactionButtonRef}
									type="button"
									className={clsx(styles.addReactionButton, emojiPickerOpen && styles.addReactionButtonActive)}
									aria-label={t`Add Reaction`}
									data-action="message-add-reaction-button"
									onClick={handleEmojiPickerOpen}
								>
									<SmileyIcon size={20} weight="fill" />
								</button>
							</FocusRing>
							<ExpressionPickerSheet
								isOpen={emojiPickerOpen}
								onClose={handleEmojiPickerClose}
								channelId={message.channelId}
								onEmojiSelect={handlers.handleEmojiSelect}
								visibleTabs={['emojis']}
							/>
						</>
					) : (
						<Popout
							render={({onClose}) => (
								<EmojiPickerPopout
									channelId={message.channelId}
									handleSelect={handlers.handleEmojiSelect}
									onClose={onClose}
								/>
							)}
							position="right-start"
							uniqueId={`emoji_picker-reactions-${message.id}`}
							shouldAutoUpdate={false}
							animationType="none"
							onOpen={handleEmojiPickerOpen}
							onClose={handleEmojiPickerClose}
						>
							<FocusRing offset={-2}>
								<button
									ref={addReactionButtonRef}
									type="button"
									className={clsx(styles.addReactionButton, emojiPickerOpen && styles.addReactionButtonActive)}
									aria-label={t`Add Reaction`}
									data-action="message-add-reaction-button"
								>
									<SmileyIcon size={20} weight="fill" />
								</button>
							</FocusRing>
						</Popout>
					))}
			</div>
		);
	},
);
