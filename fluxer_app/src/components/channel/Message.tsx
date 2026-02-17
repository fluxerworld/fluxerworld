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
import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import {MessageActionBar, MessageActionBarCore} from '@app/components/channel/MessageActionBar';
import {MessageActionBottomSheet} from '@app/components/channel/MessageActionBottomSheet';
import {requestDeleteMessage} from '@app/components/channel/MessageActionUtils';
import {MessageViewContextProvider} from '@app/components/channel/MessageViewContext';
import {MessageContextMenu} from '@app/components/uikit/context_menu/MessageContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import {parse} from '@app/lib/markdown/renderers';
import {MarkdownContext} from '@app/lib/markdown/renderers/RendererTypes';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MessageEditStore from '@app/stores/MessageEditStore';
import MessageFocusStore from '@app/stores/MessageFocusStore';
import MessageReplyStore from '@app/stores/MessageReplyStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import styles from '@app/styles/Message.module.css';
import {getMessageComponent} from '@app/utils/MessageComponentUtils';
import {FLUXERBOT_ID} from '@fluxer/constants/src/AppConstants';
import {
	MessageEmbedTypes,
	MessagePreviewContext,
	MessageStates,
	MessageTypes,
} from '@fluxer/constants/src/ChannelConstants';
import {NodeType} from '@fluxer/markdown_parser/src/types/Enums';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';

const shouldApplyGroupedLayout = (message: MessageRecord, _prevMessage?: MessageRecord) => {
	if (message.type !== MessageTypes.DEFAULT && message.type !== MessageTypes.REPLY) {
		return false;
	}
	return true;
};

const isDisplaySystemMessage = (message: MessageRecord): boolean =>
	message.type !== MessageTypes.DEFAULT && message.type !== MessageTypes.REPLY;

const isActivationKey = (key: string) => key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 'Space';

const handleAltClickEvent = (event: React.MouseEvent, message: MessageRecord) => {
	if (!event.altKey) return;
	ReadStateActionCreators.markAsUnread(message.channelId, message.id);
};

const handleAltKeyboardEvent = (event: React.KeyboardEvent, message: MessageRecord) => {
	if (!event.altKey || !isActivationKey(event.key)) {
		return;
	}
	event.preventDefault();
	ReadStateActionCreators.markAsUnread(message.channelId, message.id);
};

const getContextMenuLinkUrl = (target: EventTarget | null): string | undefined => {
	if (!(target instanceof HTMLElement)) {
		return undefined;
	}

	const anchor = target.closest('a');
	if (anchor?.href) {
		return anchor.href;
	}

	const mediaTarget = target.closest('[data-message-emoji="true"], [data-message-sticker="true"]');
	if (!mediaTarget) {
		return undefined;
	}

	const imageElement =
		mediaTarget instanceof HTMLImageElement ? mediaTarget : mediaTarget.querySelector<HTMLImageElement>('img');
	if (!imageElement) {
		return undefined;
	}

	const imageUrl = imageElement.currentSrc || imageElement.src;
	return imageUrl || undefined;
};

export type MessageBehaviorOverrides = Partial<{
	mobileLayoutEnabled: boolean;
	messageGroupSpacing: number;
	messageDisplayCompact: boolean;
	prefersReducedMotion: boolean;
	isEditing: boolean;
	isReplying: boolean;
	isHighlight: boolean;
	forceUnknownMessageType: boolean;
	contextMenuOpen: boolean;
	disableContextMenu: boolean;
	disableContextMenuTracking: boolean;
}>;

interface MessageProps {
	channel: ChannelRecord;
	message: MessageRecord;
	prevMessage?: MessageRecord;
	onEdit?: (targetNode: HTMLElement) => void;
	previewContext?: keyof typeof MessagePreviewContext;
	shouldGroup?: boolean;
	previewOverrides?: {
		usernameColor?: string;
		displayName?: string;
	};
	removeTopSpacing?: boolean;
	isJumpTarget?: boolean;
	previewMode?: boolean;
	behaviorOverrides?: MessageBehaviorOverrides;
	compact?: boolean;
	idPrefix?: string;
	readonlyPreview?: boolean;
}

export const Message: React.FC<MessageProps> = observer((props) => {
	const {
		channel,
		message,
		prevMessage,
		onEdit,
		previewContext,
		shouldGroup = false,
		previewOverrides,
		removeTopSpacing = false,
		isJumpTarget = false,
		previewMode,
		behaviorOverrides,
		compact,
		idPrefix = 'message',
		readonlyPreview,
	} = props;

	const {i18n} = useLingui();

	const [showActionBar, setShowActionBar] = useState(false);
	const [isLongPressing, setIsLongPressing] = useState(false);
	const [isHoveringDesktop, setIsHoveringDesktop] = useState(false);
	const [isFocusedWithin, setIsFocusedWithin] = useState(false);
	const [isPopoutOpen, setIsPopoutOpen] = useState(false);

	const messageRef = useRef<HTMLDivElement | null>(null);
	const disableContextMenuTracking = behaviorOverrides?.disableContextMenuTracking ?? false;
	const trackedContextMenuOpen = useContextMenuHoverState(messageRef, !disableContextMenuTracking);
	const contextMenuOpen = disableContextMenuTracking
		? (behaviorOverrides?.contextMenuOpen ?? false)
		: trackedContextMenuOpen;
	const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
	const wasEditingInPreviousUpdateRef = useRef(false);

	const mobileLayoutEnabled = behaviorOverrides?.mobileLayoutEnabled ?? MobileLayoutStore.isEnabled();
	const messageDisplayCompact =
		compact ?? behaviorOverrides?.messageDisplayCompact ?? UserSettingsStore.getMessageDisplayCompact();
	const prefersReducedMotion = behaviorOverrides?.prefersReducedMotion ?? AccessibilityStore.useReducedMotion;
	const isEditing = behaviorOverrides?.isEditing ?? MessageEditStore.isEditing(message.channelId, message.id);
	const isReplying = behaviorOverrides?.isReplying ?? MessageReplyStore.isReplying(message.channelId, message.id);
	const isHighlight = behaviorOverrides?.isHighlight ?? MessageReplyStore.isHighlight(message.id);
	const forceUnknownMessageType =
		behaviorOverrides?.forceUnknownMessageType ?? DeveloperOptionsStore.forceUnknownMessageType;
	const messageGroupSpacing = behaviorOverrides?.messageGroupSpacing ?? AccessibilityStore.messageGroupSpacingValue;

	const handleAltClick = useCallback(
		(event: React.MouseEvent) => {
			handleAltClickEvent(event, message);
		},
		[message],
	);
	const handleAltKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			handleAltKeyboardEvent(event, message);
		},
		[message],
	);

	const handleDelete = useCallback(
		(bypassConfirm = false) => {
			requestDeleteMessage(message, i18n, bypassConfirm);
		},
		[i18n, message],
	);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			if (behaviorOverrides?.disableContextMenu) {
				event.preventDefault();
				return;
			}
			if (
				(previewContext && previewContext !== MessagePreviewContext.LIST_POPOUT) ||
				message.state === MessageStates.SENDING ||
				isEditing
			) {
				return;
			}
			event.preventDefault();
			if (mobileLayoutEnabled) {
				return;
			}
			MessageFocusStore.holdContextFocus(channel.id, message.id, message);

			const linkUrl = getContextMenuLinkUrl(event.target);

			ContextMenuActionCreators.openFromEvent(event, (props) => (
				<MessageContextMenu message={message} onClose={props.onClose} onDelete={handleDelete} linkUrl={linkUrl} />
			));
		},
		[previewContext, message, isEditing, mobileLayoutEnabled, handleDelete, behaviorOverrides?.disableContextMenu],
	);

	const LONG_PRESS_DELAY = 500;
	const MOVEMENT_THRESHOLD = 10;
	const SWIPE_VELOCITY_THRESHOLD = 0.4;
	const HIGHLIGHT_DELAY = 100;

	const touchStartPos = useRef<{x: number; y: number} | null>(null);
	const velocitySamples = useRef<Array<{x: number; y: number; timestamp: number}>>([]);
	const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

	const clearLongPressState = useCallback(() => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
		if (highlightTimerRef.current) {
			clearTimeout(highlightTimerRef.current);
			highlightTimerRef.current = null;
		}
		touchStartPos.current = null;
		velocitySamples.current = [];
		setIsLongPressing(false);
	}, []);

	const calculateVelocity = useCallback((): number => {
		const samples = velocitySamples.current;
		if (samples.length < 2) return 0;

		const now = performance.now();
		const recentSamples = samples.filter((s) => now - s.timestamp < 100);
		if (recentSamples.length < 2) return 0;

		const first = recentSamples[0];
		const last = recentSamples[recentSamples.length - 1];
		const dt = last.timestamp - first.timestamp;
		if (dt === 0) return 0;

		const dx = last.x - first.x;
		const dy = last.y - first.y;
		return Math.sqrt(dx * dx + dy * dy) / dt;
	}, []);

	const handleLongPressStart = useCallback(
		(event: React.TouchEvent) => {
			if (!mobileLayoutEnabled || previewContext) {
				return;
			}
			const touch = event.touches[0];
			if (!touch) return;

			touchStartPos.current = {x: touch.clientX, y: touch.clientY};
			velocitySamples.current = [{x: touch.clientX, y: touch.clientY, timestamp: performance.now()}];

			highlightTimerRef.current = setTimeout(() => {
				if (touchStartPos.current) {
					setIsLongPressing(true);
				}
				highlightTimerRef.current = null;
			}, HIGHLIGHT_DELAY);

			longPressTimerRef.current = setTimeout(() => {
				if (touchStartPos.current) {
					setShowActionBar(true);
					setIsLongPressing(false);
				}
				clearLongPressState();
			}, LONG_PRESS_DELAY);
		},
		[mobileLayoutEnabled, previewContext, clearLongPressState],
	);

	const handleLongPressEnd = useCallback(() => {
		clearLongPressState();
	}, [clearLongPressState]);

	const handleLongPressMove = useCallback(
		(event: React.TouchEvent) => {
			if (!touchStartPos.current) return;
			const touch = event.touches[0];
			if (!touch) return;

			velocitySamples.current.push({x: touch.clientX, y: touch.clientY, timestamp: performance.now()});
			if (velocitySamples.current.length > 10) {
				velocitySamples.current = velocitySamples.current.slice(-10);
			}

			const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
			const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);

			if (deltaX > MOVEMENT_THRESHOLD || deltaY > MOVEMENT_THRESHOLD) {
				clearLongPressState();
				return;
			}

			const velocity = calculateVelocity();
			if (velocity > SWIPE_VELOCITY_THRESHOLD) {
				clearLongPressState();
			}
		},
		[clearLongPressState, calculateVelocity],
	);

	const keyboardModeEnabled = KeyboardModeStore.keyboardModeEnabled;

	const handleFocusWithin = useCallback(() => {
		if (!keyboardModeEnabled) {
			return;
		}
		setIsFocusedWithin(true);
		MessageFocusStore.focusMessage(channel.id, message.id, message);
	}, [channel.id, message, keyboardModeEnabled]);

	const handleBlurWithin = useCallback(() => {
		setIsFocusedWithin(false);
		MessageFocusStore.blurMessage(channel.id, message.id);
	}, [channel.id, message.id]);

	useEffect(() => {
		if (mobileLayoutEnabled || !messageRef.current) return;
		const element = messageRef.current;
		const syncHoverState = () => {
			setIsHoveringDesktop(element.matches(':hover'));
		};
		const handleMouseEnter = () => {
			setIsHoveringDesktop(true);
		};
		const handleMouseLeave = () => {
			setIsHoveringDesktop(false);
		};
		element.addEventListener('mouseenter', handleMouseEnter);
		element.addEventListener('mouseleave', handleMouseLeave);
		window.addEventListener('focus', syncHoverState);
		const rafId = requestAnimationFrame(syncHoverState);
		return () => {
			cancelAnimationFrame(rafId);
			element.removeEventListener('mouseenter', handleMouseEnter);
			element.removeEventListener('mouseleave', handleMouseLeave);
			window.removeEventListener('focus', syncHoverState);
		};
	}, [mobileLayoutEnabled, keyboardModeEnabled]);

	useEffect(() => {
		if (!keyboardModeEnabled) return;
		if (contextMenuOpen) {
			MessageFocusStore.holdContextFocus(channel.id, message.id, message);
			return;
		}
		MessageFocusStore.releaseContextFocus(channel.id, message.id);
		if (!isFocusedWithin) {
			MessageFocusStore.clearFocusedMessageIfMatches(channel.id, message.id);
		}
	}, [channel.id, contextMenuOpen, isFocusedWithin, keyboardModeEnabled, message, message.id]);

	useLayoutEffect(() => {
		const wasEditing = wasEditingInPreviousUpdateRef.current;
		const justStartedEditing = !wasEditing && isEditing;

		if (justStartedEditing && onEdit && messageRef.current) {
			onEdit(messageRef.current);
		}

		wasEditingInPreviousUpdateRef.current = isEditing;
	}, [isEditing, onEdit]);

	useEffect(() => {
		if (!mobileLayoutEnabled) return;

		const handleScroll = () => {
			if (touchStartPos.current) {
				clearLongPressState();
			}
		};

		window.addEventListener('scroll', handleScroll, {capture: true, passive: true});
		return () => {
			window.removeEventListener('scroll', handleScroll, {capture: true});
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
			}
			if (highlightTimerRef.current) {
				clearTimeout(highlightTimerRef.current);
			}
		};
	}, [mobileLayoutEnabled, clearLongPressState]);

	const isHovering = mobileLayoutEnabled ? false : isHoveringDesktop;

	useEffect(() => {
		if (!keyboardModeEnabled) {
			setIsFocusedWithin(false);
			return;
		}
		const activeElement = messageRef.current?.ownerDocument?.activeElement ?? document.activeElement;
		if (messageRef.current && activeElement && messageRef.current.contains(activeElement)) {
			setIsFocusedWithin(true);
		}
	}, [keyboardModeEnabled]);
	const actionBarHoverState = previewMode
		? true
		: isHovering || (keyboardModeEnabled && isFocusedWithin) || isPopoutOpen;

	const messageContextValue = useMemo(
		() => ({
			channel,
			message,
			handleDelete,
			shouldGroup,
			isHovering,
			messageDisplayCompact,
			previewContext,
			previewOverrides,
			previewPermissions: previewMode
				? {
						isDM: false,
						canSendMessages: true,
						canAddReactions: true,
						canEditMessage: true,
						canDeleteMessage: true,
						canDeleteAttachment: true,
						canPinMessage: true,
						canSuppressEmbeds: true,
						shouldRenderSuppressEmbeds: false,
					}
				: undefined,
			onPopoutToggle: setIsPopoutOpen,
			readonlyPreview,
		}),
		[
			channel,
			message,
			handleDelete,
			shouldGroup,
			isHovering,
			messageDisplayCompact,
			previewContext,
			previewOverrides,
			previewMode,
			setIsPopoutOpen,
			readonlyPreview,
		],
	);

	const messageComponent = (
		<MessageViewContextProvider value={messageContextValue}>
			{getMessageComponent(message, channel, forceUnknownMessageType)}
		</MessageViewContextProvider>
	);

	const {nodes: astNodes} = parse({
		content: message.content,
		context: MarkdownContext.STANDARD_WITH_JUMBO,
	});

	const shouldHideContent =
		UserSettingsStore.getRenderEmbeds() &&
		message.embeds.length > 0 &&
		message.embeds.every((embed) => embed.type === MessageEmbedTypes.IMAGE || embed.type === MessageEmbedTypes.GIFV) &&
		astNodes.length === 1 &&
		astNodes[0].type === NodeType.Link &&
		!message.suppressEmbeds;

	const shouldDisableHoverBackground = (prefersReducedMotion && !isEditing) || readonlyPreview;
	const isKeyboardFocused = keyboardModeEnabled && isFocusedWithin;
	const shouldApplySpacing = !shouldGroup && !removeTopSpacing && previewContext !== MessagePreviewContext.LIST_POPOUT;
	const systemFollowsSystem = Boolean(
		shouldGroup && prevMessage && isDisplaySystemMessage(prevMessage) && isDisplaySystemMessage(message),
	);

	const messageClasses = useMemo(
		() =>
			clsx(
				messageDisplayCompact ? styles.messageCompact : styles.message,
				shouldDisableHoverBackground && styles.messageNoHover,
				isEditing && styles.messageEditing,
				!messageDisplayCompact &&
					shouldGroup &&
					shouldApplyGroupedLayout(message, prevMessage) &&
					styles.messageGrouped,
				systemFollowsSystem && styles.systemMessageFollowsSystem,
				!previewContext && message.isMentioned() && styles.messageMentioned,
				!previewContext &&
					(isReplying || isHighlight || isJumpTarget) &&
					(isReplying ? styles.messageReplying : styles.messageHighlight),
				message.type === MessageTypes.CLIENT_SYSTEM && message.author.id === FLUXERBOT_ID && styles.messageClientSystem,
				isLongPressing && styles.messageLongPress,
				!previewContext && (contextMenuOpen || isPopoutOpen) && styles.contextMenuActive,
				previewContext && styles.messagePreview,
				MobileLayoutStore.isEnabled() && styles.mobileLayout,
				!messageDisplayCompact &&
					(!message.content || shouldHideContent) &&
					!isEditing &&
					message.isUserMessage() &&
					styles.messageNoText,
				isKeyboardFocused && styles.keyboardFocused,
				isKeyboardFocused && 'keyboard-focus-active',
				shouldApplySpacing && previewContext && styles.messagePreviewSpacing,
			),
		[
			messageDisplayCompact,
			shouldDisableHoverBackground,
			isEditing,
			systemFollowsSystem,
			shouldGroup,
			message,
			prevMessage,
			previewContext,
			isReplying,
			isHighlight,
			isJumpTarget,
			isLongPressing,
			contextMenuOpen,
			isPopoutOpen,
			shouldHideContent,
			isKeyboardFocused,
			shouldApplySpacing,
		],
	);

	const shouldShowActionBar = useMemo(
		() =>
			!previewContext &&
			!readonlyPreview &&
			message.state !== MessageStates.SENDING &&
			!isEditing &&
			!MobileLayoutStore.isEnabled(),
		[previewContext, readonlyPreview, message.state, isEditing],
	);

	const shouldShowBottomSheet = useMemo(
		() =>
			MobileLayoutStore.isEnabled() &&
			showActionBar &&
			!previewContext &&
			message.state !== MessageStates.SENDING &&
			!isEditing,
		[showActionBar, previewContext, message.state, isEditing],
	);

	return (
		<>
			<FocusRing>
				<div
					role="article"
					id={`${idPrefix}-${channel.id}-${message.id}`}
					data-message-id={message.id}
					data-channel-id={channel.id}
					tabIndex={keyboardModeEnabled ? 0 : undefined}
					className={messageClasses}
					ref={messageRef}
					onClick={handleAltClick}
					onKeyDown={handleAltKeyDown}
					onFocus={handleFocusWithin}
					onBlur={handleBlurWithin}
					onContextMenu={handleContextMenu}
					onTouchStart={handleLongPressStart}
					onTouchEnd={handleLongPressEnd}
					onTouchMove={handleLongPressMove}
					style={{
						touchAction: 'pan-y',
						WebkitUserSelect: 'text',
						userSelect: 'text',
						marginTop: shouldApplySpacing && previewContext ? `${messageGroupSpacing}px` : undefined,
					}}
				>
					{messageComponent}
					{shouldShowActionBar &&
						(previewMode ? (
							<MessageActionBarCore
								message={message}
								handleDelete={handleDelete}
								permissions={{
									canSendMessages: true,
									canAddReactions: true,
									canEditMessage: true,
									canDeleteMessage: true,
									canPinMessage: true,
									shouldRenderSuppressEmbeds: true,
								}}
								isSaved={false}
								developerMode={false}
								isHovering={actionBarHoverState}
								onPopoutToggle={setIsPopoutOpen}
							/>
						) : (
							<MessageActionBar
								message={message}
								handleDelete={handleDelete}
								isHovering={actionBarHoverState}
								onPopoutToggle={setIsPopoutOpen}
							/>
						))}
				</div>
			</FocusRing>

			{shouldShowBottomSheet && (
				<MessageActionBottomSheet
					isOpen={shouldShowBottomSheet}
					onClose={() => setShowActionBar(false)}
					message={message}
					handleDelete={handleDelete}
				/>
			)}
		</>
	);
});
