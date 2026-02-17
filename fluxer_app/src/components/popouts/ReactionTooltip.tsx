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
import {MessageReactionsModal} from '@app/components/modals/MessageReactionsModal';
import {EmojiTooltipContent} from '@app/components/uikit/emoji_tooltip_content/EmojiTooltipContent';
import {useTooltipPortalRoot} from '@app/components/uikit/tooltip/Tooltip';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {useReactionTooltip} from '@app/hooks/useReactionTooltip';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import MessageReactionsStore from '@app/stores/MessageReactionsStore';
import {getReactionTooltip, useEmojiURL} from '@app/utils/ReactionUtils';
import {getReducedMotionProps, TOOLTIP_MOTION} from '@app/utils/ReducedMotionAnimation';
import {FloatingPortal} from '@floating-ui/react';
import type {MessageReaction} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import React, {useEffect, useMemo, useRef} from 'react';

export const ReactionTooltip = observer(
	({
		message,
		reaction,
		children,
		hoveredEmojiUrl,
		animationSyncKey,
		onRequestAnimationSync,
		onTooltipHoverChange,
	}: {
		message: MessageRecord;
		reaction: MessageReaction;
		children: React.ReactElement<Record<string, unknown> & {ref?: React.Ref<HTMLElement>}>;
		hoveredEmojiUrl?: string | null;
		animationSyncKey?: number;
		onRequestAnimationSync?: () => void;
		onTooltipHoverChange?: (hovering: boolean) => void;
	}) => {
		const {t} = useLingui();
		const tooltipPortalRoot = useTooltipPortalRoot();
		const tooltipMotion = getReducedMotionProps(TOOLTIP_MOTION, AccessibilityStore.useReducedMotion);
		const {targetRef, tooltipRef, state, updatePosition, handlers, tooltipHandlers, hide} = useReactionTooltip(500);

		const prevIsOpenRef = useRef(false);
		useEffect(() => {
			if (state.isOpen && !prevIsOpenRef.current) {
				onRequestAnimationSync?.();
			}
			prevIsOpenRef.current = state.isOpen;
		}, [state.isOpen, onRequestAnimationSync]);

		useEffect(() => {
			if (!state.isOpen) {
				onTooltipHoverChange?.(false);
			}
		}, [state.isOpen, onTooltipHoverChange]);

		const fetchStatus = MessageReactionsStore.getFetchStatus(message.id, reaction.emoji);
		const isLoading = fetchStatus === 'pending';
		const tooltipText = getReactionTooltip(message, reaction.emoji);
		const emojiIdentifier = reaction.emoji.id ?? reaction.emoji.name;
		const tooltipEmojiKey = `${emojiIdentifier}-${animationSyncKey ?? 0}`;
		const fallbackEmojiUrl = useEmojiURL({
			emoji: reaction.emoji,
			isHovering: state.isOpen,
			forceAnimate: state.isOpen,
		});
		const emojiUrl = hoveredEmojiUrl ?? fallbackEmojiUrl;

		useEffect(() => {
			if (!state.isOpen || fetchStatus === 'pending' || fetchStatus === 'error') {
				return;
			}
			if (fetchStatus === 'idle') {
				ReactionActionCreators.getReactions(message.channelId, message.id, reaction.emoji, 3).catch((_error) => {});
			}
		}, [state.isOpen, message.channelId, message.id, reaction.emoji, fetchStatus]);

		const handleClick = () => {
			hide();
			ModalActionCreators.push(
				modal(() => (
					<MessageReactionsModal channelId={message.channelId} messageId={message.id} openToReaction={reaction} />
				)),
			);
		};

		const tooltipMouseHandlers = useMemo(
			() => ({
				...tooltipHandlers,
				onMouseEnter(event: React.MouseEvent) {
					tooltipHandlers.onMouseEnter(event);
					onTooltipHoverChange?.(true);
				},
				onMouseLeave(event: React.MouseEvent) {
					tooltipHandlers.onMouseLeave(event);
					onTooltipHoverChange?.(false);
				},
			}),
			[tooltipHandlers, onTooltipHoverChange],
		);

		const child = React.Children.only(children);
		const childRef = child.props.ref ?? null;
		const mergedRef = useMergeRefs([targetRef, childRef]);

		return (
			<>
				{React.cloneElement(child, {
					ref: mergedRef,
					...handlers,
				})}
				{state.isOpen && (
					<FloatingPortal root={tooltipPortalRoot}>
						<AnimatePresence>
							<motion.div
								ref={(node: HTMLDivElement | null) => {
									(tooltipRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
									if (node && targetRef.current) {
										updatePosition();
									}
								}}
								style={{
									position: 'fixed',
									left: state.x,
									top: state.y,
									zIndex: 'var(--z-index-tooltip)',
									visibility: state.isReady ? 'visible' : 'hidden',
								}}
								{...tooltipMotion}
								{...tooltipMouseHandlers}
							>
								<EmojiTooltipContent
									emojiUrl={emojiUrl}
									emojiAlt={reaction.emoji.name}
									emojiKey={tooltipEmojiKey}
									primaryContent={tooltipText}
									subtext={t`Click to view all reactions`}
									isLoading={isLoading}
									interactive
									onClick={handleClick}
								/>
							</motion.div>
						</AnimatePresence>
					</FloatingPortal>
				)}
			</>
		);
	},
);
