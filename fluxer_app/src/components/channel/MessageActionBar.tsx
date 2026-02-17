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
import {modal} from '@app/actions/ModalActionCreators';
import * as PopoutActionCreators from '@app/actions/PopoutActionCreators';
import styles from '@app/components/channel/MessageActionBar.module.css';
import {
	createMessageActionHandlers,
	isClientSystemMessage,
	isEmbedsSuppressed,
	triggerAddReaction,
	useMessagePermissions,
} from '@app/components/channel/MessageActionUtils';
import {MessageDebugModal} from '@app/components/debug/MessageDebugModal';
import {EmojiPickerPopout} from '@app/components/popouts/EmojiPickerPopout';
import {
	AddReactionIcon,
	BookmarkIcon,
	CopyIdIcon,
	CopyLinkIcon,
	CopyMessageTextIcon,
	DebugMessageIcon,
	DeleteIcon,
	EditMessageIcon,
	ForwardIcon,
	MarkAsUnreadIcon,
	MoreIcon,
	PinIcon,
	ReplyIcon,
	RetryIcon,
	SuppressEmbedsIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {KeybindHint} from '@app/components/uikit/keybind_hint/KeybindHint';
import {Popout} from '@app/components/uikit/popout/Popout';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ContextMenuStore from '@app/stores/ContextMenuStore';
import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import EmojiStore from '@app/stores/EmojiStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import messageStyles from '@app/styles/Message.module.css';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {getEmojiDisplayData} from '@app/utils/SkinToneUtils';
import {MessageStates} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {autorun} from 'mobx';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';

const shiftKeyManager = (() => {
	let isShiftPressed = false;
	const listeners = new Set<() => void>();
	let notifyTimeout: NodeJS.Timeout | null = null;

	const scheduleNotify = () => {
		if (notifyTimeout) return;
		notifyTimeout = setTimeout(() => {
			notifyTimeout = null;
			listeners.forEach((listener) => listener());
		}, 0);
	};

	const setShiftPressed = (pressed: boolean) => {
		if (isShiftPressed !== pressed) {
			isShiftPressed = pressed;
			scheduleNotify();
		}
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Shift') {
			setShiftPressed(true);
		}
	};

	const handleKeyUp = (event: KeyboardEvent) => {
		if (event.key === 'Shift') {
			setShiftPressed(false);
		}
	};

	const handleWindowBlur = () => {
		setShiftPressed(false);
	};

	window.addEventListener('keydown', handleKeyDown);
	window.addEventListener('keyup', handleKeyUp);
	window.addEventListener('blur', handleWindowBlur);

	return {
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getSnapshot: () => isShiftPressed,
		getServerSnapshot: () => false,
	};
})();

const quickReactionManager = (() => {
	let cache: Array<FlatEmoji> | null = null;
	const listeners = new Set<() => void>();

	const recompute = () => {
		const allEmojis = EmojiStore.getAllEmojis(null);
		cache = EmojiPickerStore.getQuickReactionEmojis(allEmojis, 3);
		listeners.forEach((listener) => listener());
	};

	autorun(() => {
		const usage = EmojiPickerStore.emojiUsage;
		for (const key in usage) {
			const entry = usage[key];
			entry?.count;
			entry?.lastUsed;
		}
		recompute();
	});
	ComponentDispatch.subscribe('EMOJI_PICKER_RERENDER', recompute);

	return {
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getSnapshot(): Array<FlatEmoji> {
			if (!cache) {
				recompute();
			}
			return cache ?? [];
		},
		getServerSnapshot(): Array<FlatEmoji> {
			return [];
		},
	};
})();

const useShiftKey = (enabled: boolean) => {
	const subscribe = useCallback(
		(listener: () => void) => {
			if (!enabled) {
				return () => undefined;
			}
			return shiftKeyManager.subscribe(listener);
		},
		[enabled],
	);

	const getSnapshot = useCallback(() => {
		return enabled ? shiftKeyManager.getSnapshot() : false;
	}, [enabled]);

	return useSyncExternalStore(subscribe, getSnapshot, shiftKeyManager.getServerSnapshot);
};

interface MessageActionBarButtonProps {
	label: string;
	icon: React.ReactNode;
	onClick?: (event: React.MouseEvent | React.KeyboardEvent) => void;
	onPointerDownCapture?: (event: React.PointerEvent) => void;
	danger?: boolean;
	isActive?: boolean;
	dataAction?: string;
}

const MessageActionBarButton = React.forwardRef<HTMLButtonElement, MessageActionBarButtonProps>(
	({label, icon, onClick, onPointerDownCapture, danger, isActive, dataAction}, ref) => {
		const handleClick = useCallback(
			(event: React.MouseEvent | React.KeyboardEvent) => {
				event.preventDefault();
				event.stopPropagation();
				onClick?.(event);
			},
			[onClick],
		);

		const buttonClassName = useMemo(
			() => clsx(styles.button, danger && styles.danger, isActive && styles.active),
			[danger, isActive],
		);

		return (
			<Tooltip text={label}>
				<FocusRing>
					<button
						type="button"
						ref={ref}
						aria-label={label}
						onClick={handleClick}
						onPointerDownCapture={onPointerDownCapture}
						className={buttonClassName}
						data-action={dataAction}
					>
						<div className={styles.actionBarIcon}>{icon}</div>
					</button>
				</FocusRing>
			</Tooltip>
		);
	},
);

MessageActionBarButton.displayName = 'MessageActionBarButton';

interface QuickReactionButtonProps {
	emoji: FlatEmoji;
	onReact: (emoji: FlatEmoji) => void;
}

const QuickReactionButton = observer(
	React.forwardRef<HTMLButtonElement, QuickReactionButtonProps>(({emoji, onReact}, ref) => {
		const {t} = useLingui();
		const [isHovered, setIsHovered] = useState(false);

		const {surrogates: displaySurrogates, url: displayUrl} = getEmojiDisplayData(emoji);

		const handleClick = useCallback(
			(event: React.MouseEvent | React.KeyboardEvent) => {
				event.preventDefault();
				event.stopPropagation();
				onReact(emoji);
			},
			[emoji, onReact],
		);

		const handleMouseEnter = useCallback(() => setIsHovered(true), []);
		const handleMouseLeave = useCallback(() => setIsHovered(false), []);

		const emojiNameWithColons = useMemo(() => `:${emoji.name}:`, [emoji.name]);
		const isUnicodeEmoji = useMemo(() => !emoji.guildId && !emoji.id, [emoji.guildId, emoji.id]);
		const useNativeRendering = useMemo(() => shouldUseNativeEmoji && isUnicodeEmoji, [isUnicodeEmoji]);

		const shouldShowAnimated = useMemo(() => emoji.animated && isHovered, [emoji.animated, isHovered]);
		const emojiSrc = useMemo(
			() =>
				emoji.animated && emoji.id && !useNativeRendering
					? AvatarUtils.getEmojiURL({id: emoji.id, animated: shouldShowAnimated})
					: (displayUrl ?? ''),
			[emoji.animated, emoji.id, displayUrl, useNativeRendering, shouldShowAnimated],
		);

		const tooltipContent = useCallback(
			() => (
				<div className={styles.tooltipContent}>
					<span>{emojiNameWithColons}</span>
					<span className={styles.tooltipHint}>{t`Click to react`}</span>
				</div>
			),
			[emojiNameWithColons, t],
		);

		const ariaLabel = useMemo(() => `React with ${emojiNameWithColons}`, [emojiNameWithColons]);

		return (
			<Tooltip text={tooltipContent}>
				<FocusRing>
					<button
						type="button"
						ref={ref}
						aria-label={ariaLabel}
						onClick={handleClick}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
						className={styles.button}
					>
						{useNativeRendering ? (
							<span className={styles.emojiImage}>{displaySurrogates}</span>
						) : (
							<img src={emojiSrc} alt={emoji.name} className={styles.emojiImage} />
						)}
					</button>
				</FocusRing>
			</Tooltip>
		);
	}),
);

QuickReactionButton.displayName = 'QuickReactionButton';

interface MessageActionBarCoreProps {
	message: MessageRecord;
	handleDelete: (bypassConfirm?: boolean) => void;
	permissions: {
		canSendMessages: boolean;
		canAddReactions: boolean;
		canEditMessage: boolean;
		canDeleteMessage: boolean;
		canPinMessage: boolean;
		shouldRenderSuppressEmbeds: boolean;
	};
	isSaved: boolean;
	developerMode: boolean;
	isHovering?: boolean;
	onPopoutToggle?: (isOpen: boolean) => void;
}

export const MessageActionBarCore: React.FC<MessageActionBarCoreProps> = observer(
	({message, handleDelete, permissions, isSaved, developerMode, isHovering = false, onPopoutToggle}) => {
		const {t, i18n} = useLingui();
		const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
		const moreOptionsButtonRef = useRef<HTMLButtonElement>(null);
		const emojiPickerButtonRef = useRef<HTMLButtonElement>(null);
		const actionBarRef = useRef<HTMLDivElement>(null);
		const contextMenuOpen = useContextMenuHoverState(actionBarRef);
		const moreMenuOpen = useContextMenuHoverState(moreOptionsButtonRef);

		const showMessageActionBar = AccessibilityStore.showMessageActionBar;
		const showQuickReactions = AccessibilityStore.showMessageActionBarQuickReactions;
		const showShiftExpand = AccessibilityStore.showMessageActionBarShiftExpand;
		const onlyMoreButton = AccessibilityStore.showMessageActionBarOnlyMoreButton;
		const keyboardModeEnabled = KeyboardModeStore.keyboardModeEnabled;

		const isActionBarActive = isHovering || contextMenuOpen || emojiPickerOpen || moreMenuOpen;
		const shouldListenForShift =
			showShiftExpand && showMessageActionBar && !onlyMoreButton && isActionBarActive && !keyboardModeEnabled;
		const shiftPressed = useShiftKey(shouldListenForShift);
		const showFullActions = showShiftExpand && shiftPressed;

		const {
			canSendMessages,
			canAddReactions,
			canEditMessage,
			canDeleteMessage,
			canPinMessage,
			shouldRenderSuppressEmbeds,
		} = permissions;
		const supportsInteractiveActions = useMemo(() => !isClientSystemMessage(message), [message]);

		const handlers = useMemo(() => createMessageActionHandlers(message, {i18n}), [message, i18n]);

		const quickReactionEmojis = useSyncExternalStore(
			quickReactionManager.subscribe,
			quickReactionManager.getSnapshot,
			quickReactionManager.getServerSnapshot,
		);

		const blurEmojiPickerTrigger = useCallback(() => {
			if (keyboardModeEnabled) {
				return;
			}
			requestAnimationFrame(() => emojiPickerButtonRef.current?.blur());
		}, [keyboardModeEnabled]);

		const handleEmojiPickerToggle = useCallback(
			(open: boolean) => {
				setEmojiPickerOpen(open);
				onPopoutToggle?.(open);
				if (!open) {
					blurEmojiPickerTrigger();
				}
			},
			[onPopoutToggle, blurEmojiPickerTrigger],
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

		const handleDebugClick = useCallback(() => {
			ModalActionCreators.push(modal(() => <MessageDebugModal title={t`Message Debug`} message={message} />));
		}, [message, t]);

		useEffect(() => {
			const unsubscribe = ComponentDispatch.subscribe('EMOJI_PICKER_OPEN', (payload?: unknown) => {
				const data = (payload ?? {}) as {messageId?: string};
				if (data.messageId === message.id && emojiPickerButtonRef.current) {
					PopoutActionCreators.open({
						key: `emoji_picker-${message.id}`,
						position: 'left-start',
						render: ({onClose}) => (
							<EmojiPickerPopout
								channelId={message.channelId}
								handleSelect={handlers.handleEmojiSelect}
								onClose={onClose}
							/>
						),
						target: emojiPickerButtonRef.current,
						shouldAutoUpdate: false,
						animationType: 'none',
						onOpen: () => handleEmojiPickerToggle(true),
						onClose: () => handleEmojiPickerToggle(false),
					});
				}
			});

			return () => unsubscribe();
		}, [message.id, message.channelId, handlers.handleEmojiSelect, handleEmojiPickerToggle]);

		const handleMoreOptionsPointerDown = useCallback((event: React.PointerEvent) => {
			const contextMenu = ContextMenuStore.contextMenu;
			const isOpen = !!contextMenu && contextMenu.target.target === moreOptionsButtonRef.current;

			if (isOpen) {
				event.stopPropagation();
				event.preventDefault();
				ContextMenuActionCreators.close();
			}
		}, []);

		const openMoreOptionsMenu = useCallback(
			(event: React.MouseEvent | React.KeyboardEvent) => {
				if (!showMessageActionBar) {
					return;
				}

				const contextMenu = ContextMenuStore.contextMenu;
				const isOpen = !!contextMenu && contextMenu.target.target === event.currentTarget;

				if (isOpen) {
					return;
				}

				if (!(event.nativeEvent instanceof MouseEvent)) {
					return;
				}

				ContextMenuActionCreators.openFromEvent(event as React.MouseEvent, (props) => (
					<>
						<MenuGroup>
							{canAddReactions && (
								<MenuItem
									icon={<AddReactionIcon />}
									onClick={() => {
										triggerAddReaction(message);
										props.onClose();
									}}
									shortcut={<KeybindHint action="add_reaction" />}
								>
									{t`Add Reaction`}
								</MenuItem>
							)}

							{message.isUserMessage() && !message.messageSnapshots && canEditMessage && (
								<MenuItem
									icon={<EditMessageIcon />}
									onClick={() => {
										handlers.handleEditMessage();
										props.onClose();
									}}
									shortcut={<KeybindHint action="edit_message" />}
								>
									{t`Edit Message`}
								</MenuItem>
							)}

							{message.isUserMessage() && supportsInteractiveActions && canSendMessages && (
								<MenuItem
									icon={<ReplyIcon />}
									onClick={() => {
										handlers.handleReply();
										props.onClose();
									}}
									shortcut={<KeybindHint action="reply_message" />}
								>
									{t`Reply`}
								</MenuItem>
							)}

							{message.isUserMessage() && supportsInteractiveActions && (
								<MenuItem
									icon={<ForwardIcon />}
									onClick={() => {
										handlers.handleForward();
										props.onClose();
									}}
									shortcut={<KeybindHint action="forward_message" />}
								>
									{t`Forward`}
								</MenuItem>
							)}
						</MenuGroup>

						{(message.isUserMessage() || shouldRenderSuppressEmbeds || message.content) && (
							<MenuGroup>
								{message.isUserMessage() && canPinMessage && (
									<MenuItem
										icon={<PinIcon />}
										onClick={() => {
											handlers.handlePinMessage();
											props.onClose();
										}}
										shortcut={<KeybindHint action="pin_message" />}
									>
										{message.pinned ? t`Unpin Message` : t`Pin Message`}
									</MenuItem>
								)}

								{message.isUserMessage() && supportsInteractiveActions && (
									<MenuItem
										icon={<BookmarkIcon filled={isSaved} />}
										onClick={() => {
											handlers.handleSaveMessage(isSaved)();
											props.onClose();
										}}
										shortcut="b"
									>
										{isSaved ? t`Remove Bookmark` : t`Bookmark Message`}
									</MenuItem>
								)}

								<MenuItem
									icon={<MarkAsUnreadIcon />}
									onClick={() => {
										handlers.handleMarkAsUnread();
										props.onClose();
									}}
									shortcut={<KeybindHint action="mark_unread" />}
								>
									{t`Mark as Unread`}
								</MenuItem>

								{shouldRenderSuppressEmbeds && (
									<MenuItem
										icon={<SuppressEmbedsIcon />}
										onClick={() => {
											handlers.handleToggleSuppressEmbeds();
											props.onClose();
										}}
										shortcut="s"
									>
										{isEmbedsSuppressed(message) ? t`Unsuppress Embeds` : t`Suppress Embeds`}
									</MenuItem>
								)}

								{message.content && (
									<MenuItem
										icon={<CopyMessageTextIcon />}
										onClick={() => {
											handlers.handleCopyMessage();
											props.onClose();
										}}
										shortcut={<KeybindHint action="copy_text" />}
									>
										{t`Copy Text`}
									</MenuItem>
								)}
							</MenuGroup>
						)}

						<MenuGroup>
							{supportsInteractiveActions && (
								<MenuItem
									icon={<CopyLinkIcon />}
									onClick={() => {
										handlers.handleCopyMessageLink();
										props.onClose();
									}}
									shortcut="l"
								>
									{t`Copy Message Link`}
								</MenuItem>
							)}

							<MenuItem
								icon={<CopyIdIcon />}
								onClick={() => {
									handlers.handleCopyMessageId();
									props.onClose();
								}}
							>
								{t`Copy Message ID`}
							</MenuItem>

							{developerMode && (
								<MenuItem
									icon={<DebugMessageIcon />}
									onClick={() => {
										handleDebugClick();
										props.onClose();
									}}
								>
									{t`Debug Message`}
								</MenuItem>
							)}
						</MenuGroup>

						{canDeleteMessage && (
							<MenuGroup>
								<MenuItem
									icon={<DeleteIcon />}
									onClick={(event) => {
										const shiftKey = Boolean((event as {shiftKey?: boolean} | undefined)?.shiftKey);
										handleDelete(shiftKey);
										props.onClose();
									}}
									danger
									shortcut={<KeybindHint action="delete_message" />}
								>
									{t`Delete Message`}
								</MenuItem>
							</MenuGroup>
						)}
					</>
				));
			},
			[
				canAddReactions,
				canSendMessages,
				canEditMessage,
				canPinMessage,
				shouldRenderSuppressEmbeds,
				developerMode,
				canDeleteMessage,
				message,
				supportsInteractiveActions,
				handlers,
				handleDelete,
				isSaved,
				handleDebugClick,
				showMessageActionBar,
			],
		);

		return (
			<div
				ref={actionBarRef}
				className={clsx(
					styles.actionBarContainer,
					messageStyles.buttons,
					(emojiPickerOpen || contextMenuOpen) && messageStyles.emojiPickerOpen,
				)}
			>
				<div className={styles.actionBar}>
					{message.state === MessageStates.SENT &&
						(onlyMoreButton ? (
							<MessageActionBarButton
								ref={moreOptionsButtonRef}
								icon={<MoreIcon size={20} />}
								label={t`More`}
								onPointerDownCapture={handleMoreOptionsPointerDown}
								onClick={openMoreOptionsMenu}
								isActive={moreMenuOpen}
							/>
						) : (
							<>
								{!showFullActions &&
									canAddReactions &&
									showQuickReactions &&
									quickReactionEmojis.map((emoji) => (
										<QuickReactionButton key={emoji.name} emoji={emoji} onReact={handlers.handleEmojiSelect} />
									))}

								{showFullActions && (
									<>
										{developerMode && (
											<MessageActionBarButton
												icon={<DebugMessageIcon size={20} />}
												label={t`Debug Message`}
												onClick={handleDebugClick}
											/>
										)}

										<MessageActionBarButton
											icon={<CopyIdIcon size={20} />}
											label={t`Copy Message ID`}
											onClick={handlers.handleCopyMessageId}
										/>

										{supportsInteractiveActions && (
											<MessageActionBarButton
												icon={<CopyLinkIcon size={20} />}
												label={t`Copy Message Link`}
												onClick={handlers.handleCopyMessageLink}
											/>
										)}

										{message.content && (
											<MessageActionBarButton
												icon={<CopyMessageTextIcon size={20} />}
												label={t`Copy Text`}
												onClick={handlers.handleCopyMessage}
											/>
										)}

										{shouldRenderSuppressEmbeds && (
											<MessageActionBarButton
												icon={<SuppressEmbedsIcon size={20} />}
												label={isEmbedsSuppressed(message) ? t`Unsuppress Embeds` : t`Suppress Embeds`}
												onClick={handlers.handleToggleSuppressEmbeds}
											/>
										)}

										<MessageActionBarButton
											icon={<MarkAsUnreadIcon size={20} />}
											label={t`Mark as Unread`}
											onClick={handlers.handleMarkAsUnread}
										/>

										{message.isUserMessage() && supportsInteractiveActions && (
											<MessageActionBarButton
												icon={<BookmarkIcon size={20} filled={isSaved} />}
												label={isSaved ? t`Remove Bookmark` : t`Bookmark Message`}
												onClick={handlers.handleSaveMessage(isSaved)}
											/>
										)}

										{message.isUserMessage() && canPinMessage && (
											<MessageActionBarButton
												icon={<PinIcon size={20} />}
												label={message.pinned ? t`Unpin Message` : t`Pin Message`}
												onClick={handlers.handlePinMessage}
											/>
										)}
									</>
								)}

								{canAddReactions && (
									<Popout
										render={({onClose}) => (
											<EmojiPickerPopout
												channelId={message.channelId}
												handleSelect={handlers.handleEmojiSelect}
												onClose={onClose}
											/>
										)}
										position="left-start"
										uniqueId={`emoji_picker-actionbar-${message.id}`}
										shouldAutoUpdate={false}
										animationType="none"
										onOpen={handleEmojiPickerOpen}
										onClose={handleEmojiPickerClose}
									>
										<MessageActionBarButton
											ref={emojiPickerButtonRef}
											icon={<AddReactionIcon size={20} />}
											label={t`Add Reaction`}
											isActive={emojiPickerOpen}
											dataAction="message-add-reaction-button"
										/>
									</Popout>
								)}

								{message.isUserMessage() && !message.messageSnapshots && canEditMessage && (
									<MessageActionBarButton
										icon={<EditMessageIcon size={20} />}
										label={t`Edit Message`}
										onClick={handlers.handleEditMessage}
									/>
								)}

								{message.isUserMessage() && supportsInteractiveActions && canSendMessages && (
									<MessageActionBarButton
										icon={<ReplyIcon size={20} />}
										label={t`Reply`}
										onClick={handlers.handleReply}
									/>
								)}

								{message.isUserMessage() && supportsInteractiveActions && (
									<MessageActionBarButton
										icon={<ForwardIcon size={20} />}
										label={t`Forward`}
										onClick={handlers.handleForward}
									/>
								)}

								{(!showFullActions || !canDeleteMessage) && (
									<MessageActionBarButton
										ref={moreOptionsButtonRef}
										icon={<MoreIcon size={20} />}
										label={t`More`}
										onPointerDownCapture={handleMoreOptionsPointerDown}
										onClick={openMoreOptionsMenu}
										isActive={moreMenuOpen}
									/>
								)}

								{showFullActions && canDeleteMessage && (
									<MessageActionBarButton
										danger={true}
										icon={<DeleteIcon size={20} />}
										label={t`Delete Message`}
										onClick={(event) => handleDelete(event.shiftKey)}
									/>
								)}
							</>
						))}

					{message.state === MessageStates.FAILED && (
						<>
							<MessageActionBarButton
								icon={<RetryIcon size={20} />}
								label={t`Retry`}
								onClick={handlers.handleRetryMessage}
							/>
							<MessageActionBarButton
								danger={true}
								icon={<DeleteIcon size={20} />}
								label={t`Delete Message`}
								onClick={handlers.handleFailedMessageDelete}
							/>
						</>
					)}
				</div>
			</div>
		);
	},
);

export const MessageActionBar = observer(
	({
		message,
		handleDelete,
		isHovering = false,
		onPopoutToggle,
	}: {
		message: MessageRecord;
		handleDelete: (bypassConfirm?: boolean) => void;
		isHovering?: boolean;
		onPopoutToggle?: (isOpen: boolean) => void;
	}) => {
		const isSaved = SavedMessagesStore.isSaved(message.id);
		const developerMode = UserSettingsStore.developerMode;
		const permissions = useMessagePermissions(message);

		if (!permissions) {
			return null;
		}

		return (
			<MessageActionBarCore
				message={message}
				handleDelete={handleDelete}
				permissions={permissions}
				isSaved={isSaved}
				developerMode={developerMode}
				isHovering={isHovering}
				onPopoutToggle={onPopoutToggle}
			/>
		);
	},
);
