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

import styles from '@app/components/common/custom_status_display/CustomStatusDisplay.module.css';
import {EmojiAttributionSubtext, getEmojiAttribution} from '@app/components/emojis/EmojiAttributionSubtext';
import {EmojiTooltipContent} from '@app/components/uikit/emoji_tooltip_content/EmojiTooltipContent';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip, useTooltipPortalRoot} from '@app/components/uikit/tooltip/Tooltip';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {usePresenceCustomStatus} from '@app/hooks/usePresenceCustomStatus';
import {useReactionTooltip} from '@app/hooks/useReactionTooltip';
import {type CustomStatus, getCustomStatusText, normalizeCustomStatus} from '@app/lib/CustomStatus';
import UnicodeEmojis from '@app/lib/UnicodeEmojis';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import EmojiStore from '@app/stores/EmojiStore';
import GuildStore from '@app/stores/GuildStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {getEmojiURL, shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {getReducedMotionProps, TOOLTIP_MOTION} from '@app/utils/ReducedMotionAnimation';
import {setUrlQueryParams} from '@app/utils/UrlUtils';
import {FloatingPortal} from '@floating-ui/react';
import {Trans} from '@lingui/react/macro';
import {PencilIcon, SmileyIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useLayoutEffect, useRef, useState} from 'react';

const useTextOverflow = (
	containerRef: React.RefObject<HTMLElement | null>,
	content: string | null,
	checkVertical = false,
) => {
	const [isOverflowing, setIsOverflowing] = useState(false);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el || !content) {
			setIsOverflowing(false);
			return;
		}

		const checkOverflow = () => {
			if (el.scrollWidth > el.clientWidth || (checkVertical && el.scrollHeight > el.clientHeight)) {
				setIsOverflowing(true);
				return;
			}

			const range = document.createRange();
			range.selectNodeContents(el);
			const contentWidth = range.getBoundingClientRect().width;
			const containerWidth = el.getBoundingClientRect().width;
			setIsOverflowing(Math.ceil(contentWidth) > Math.ceil(containerWidth));
		};

		const frameId = requestAnimationFrame(checkOverflow);

		const resizeObserver = new ResizeObserver(checkOverflow);
		resizeObserver.observe(el);

		return () => {
			cancelAnimationFrame(frameId);
			resizeObserver.disconnect();
		};
	}, [containerRef, content, checkVertical]);

	return isOverflowing;
};

export interface EmojiPressData {
	id: string | null;
	name: string;
	animated: boolean;
}

interface CustomStatusDisplayProps {
	className?: string;
	emojiClassName?: string;
	customStatus?: CustomStatus | null;
	userId?: string;
	showText?: boolean;
	showTooltip?: boolean;
	allowJumboEmoji?: boolean;
	maxLines?: number;
	isEditable?: boolean;
	onEdit?: () => void;
	onEmojiPress?: (emoji: EmojiPressData) => void;
	constrained?: boolean;
	showPlaceholder?: boolean;
	animateOnParentHover?: boolean;
	alwaysAnimate?: boolean;
}

interface ClampedStyle extends React.CSSProperties {
	'--max-lines'?: number;
}

const sanitizeText = (text: string): string => {
	return text.replace(/[\r\n]+/g, ' ').trim();
};

const getTooltipEmojiUrl = (status: CustomStatus): string | null => {
	if (status.emojiId) {
		const emoji = EmojiStore.getEmojiById(status.emojiId);
		const isAnimated = emoji?.animated ?? status.emojiAnimated ?? false;
		return setUrlQueryParams(AvatarUtils.getEmojiURL({id: status.emojiId, animated: isAnimated}), {
			size: 96,
			quality: 'lossless',
		});
	}
	if (status.emojiName && !shouldUseNativeEmoji) {
		return getEmojiURL(status.emojiName);
	}
	return null;
};

interface StatusEmojiWithTooltipProps {
	status: CustomStatus;
	children: React.ReactNode;
	onClick?: () => void;
	isButton?: boolean;
}

const StatusEmojiWithTooltip = observer(
	({status, children, onClick, isButton = false}: StatusEmojiWithTooltipProps) => {
		const tooltipPortalRoot = useTooltipPortalRoot();
		const tooltipMotion = getReducedMotionProps(TOOLTIP_MOTION, AccessibilityStore.useReducedMotion);
		const {targetRef, tooltipRef, state, updatePosition, handlers, tooltipHandlers} = useReactionTooltip(500);
		const emoji = status.emojiId ? EmojiStore.getEmojiById(status.emojiId) : null;
		const attribution = getEmojiAttribution({
			emojiId: status.emojiId,
			guildId: emoji?.guildId ?? null,
			guild: emoji?.guildId ? GuildStore.getGuild(emoji.guildId) : null,
			emojiName: status.emojiName,
		});

		const getEmojiDisplayName = (): string => {
			if (status.emojiId) {
				return `:${status.emojiName}:`;
			}
			if (status.emojiName) {
				return UnicodeEmojis.convertSurrogateToName(status.emojiName, true, status.emojiName);
			}
			return '';
		};

		const emojiName = getEmojiDisplayName();
		const tooltipEmojiUrl = getTooltipEmojiUrl(status);

		const triggerRef = useRef<HTMLElement>(null);
		const mergedRef = useMergeRefs([targetRef, triggerRef]);

		const TriggerComponent = isButton ? 'button' : 'span';
		const triggerProps = isButton
			? {type: 'button' as const, className: styles.emojiPressable, onClick}
			: {className: styles.emojiTooltipTrigger};

		return (
			<>
				<TriggerComponent
					ref={mergedRef as React.Ref<HTMLButtonElement & HTMLSpanElement>}
					{...triggerProps}
					{...handlers}
				>
					{children}
				</TriggerComponent>
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
								{...tooltipHandlers}
							>
								<EmojiTooltipContent
									emojiUrl={tooltipEmojiUrl}
									emoji={shouldUseNativeEmoji && status.emojiName && !status.emojiId ? status.emojiName : undefined}
									emojiAlt={status.emojiName ?? undefined}
									primaryContent={emojiName}
									subtext={
										<EmojiAttributionSubtext
											attribution={attribution}
											classes={{
												container: styles.emojiTooltipSubtext,
												guildRow: styles.emojiTooltipGuildRow,
												guildIcon: styles.emojiTooltipGuildIcon,
												guildName: styles.emojiTooltipGuildName,
												verifiedIcon: styles.emojiTooltipVerifiedIcon,
											}}
										/>
									}
								/>
							</motion.div>
						</AnimatePresence>
					</FloatingPortal>
				)}
			</>
		);
	},
);

interface EmojiRenderResult {
	node: React.ReactNode;
	altText: string;
}

const renderStatusEmoji = (
	status: CustomStatus,
	emojiClassName?: string,
	animateOnParentHover?: boolean,
	alwaysAnimate?: boolean,
): EmojiRenderResult | null => {
	if (status.emojiId) {
		const emoji = EmojiStore.getEmojiById(status.emojiId);
		const altText = `:${status.emojiName}:`;
		const isAnimated = emoji?.animated ?? status.emojiAnimated ?? false;
		const staticUrl = setUrlQueryParams(AvatarUtils.getEmojiURL({id: status.emojiId, animated: false}), {
			size: 96,
			quality: 'lossless',
		});
		const animatedUrl = isAnimated
			? setUrlQueryParams(AvatarUtils.getEmojiURL({id: status.emojiId, animated: true}), {
					size: 96,
					quality: 'lossless',
				})
			: null;

		if (alwaysAnimate && animatedUrl) {
			return {
				node: (
					<img
						src={animatedUrl}
						alt={status.emojiName ?? undefined}
						draggable={false}
						className={clsx(styles.statusEmoji, emojiClassName)}
					/>
				),
				altText,
			};
		}

		if (animateOnParentHover && animatedUrl) {
			return {
				node: (
					<span className={styles.statusEmojiWrapper}>
						<img
							src={staticUrl}
							alt={status.emojiName ?? undefined}
							draggable={false}
							className={clsx(styles.statusEmoji, styles.staticEmoji, emojiClassName)}
						/>
						<img
							src={animatedUrl}
							alt={status.emojiName ?? undefined}
							draggable={false}
							className={clsx(styles.statusEmoji, styles.animatedEmoji, emojiClassName)}
						/>
					</span>
				),
				altText,
			};
		}

		return {
			node: (
				<img
					src={staticUrl}
					alt={status.emojiName ?? undefined}
					draggable={false}
					className={clsx(styles.statusEmoji, emojiClassName)}
				/>
			),
			altText,
		};
	}

	if (status.emojiName) {
		const altText = status.emojiName;

		if (!shouldUseNativeEmoji) {
			const twemojiUrl = getEmojiURL(status.emojiName);
			if (twemojiUrl) {
				return {
					node: (
						<img
							src={twemojiUrl}
							alt={status.emojiName}
							draggable={false}
							className={clsx(styles.statusEmoji, emojiClassName)}
						/>
					),
					altText,
				};
			}
		}
		return {
			node: <span className={clsx(styles.statusEmoji, styles.nativeEmoji, emojiClassName)}>{status.emojiName}</span>,
			altText,
		};
	}

	return null;
};

export const CustomStatusDisplay = observer(
	({
		className,
		emojiClassName,
		customStatus,
		userId,
		showText = true,
		showTooltip = true,
		allowJumboEmoji = false,
		maxLines = 1,
		isEditable = false,
		onEdit,
		onEmojiPress,
		constrained = false,
		showPlaceholder = false,
		animateOnParentHover = false,
		alwaysAnimate = false,
	}: CustomStatusDisplayProps) => {
		const containerRef = useRef<HTMLDivElement>(null);
		const shouldFetchFromPresence = customStatus === undefined && userId !== undefined;
		const presenceStatus = usePresenceCustomStatus({
			userId: userId ?? '',
			enabled: shouldFetchFromPresence,
		});
		const status = shouldFetchFromPresence ? presenceStatus : (customStatus ?? null);
		const normalized = normalizeCustomStatus(status);
		const displayText = normalized?.text ? sanitizeText(normalized.text) : null;
		const isOverflowing = useTextOverflow(containerRef, displayText, maxLines > 1);

		if (!normalized) {
			if (showPlaceholder && isEditable && onEdit) {
				return (
					<FocusRing offset={-2}>
						<button type="button" className={styles.placeholder} onClick={onEdit}>
							<SmileyIcon size={14} weight="regular" className={styles.placeholderIcon} />
							<span className={styles.placeholderText}>
								<Trans>Set a custom status</Trans>
							</span>
						</button>
					</FocusRing>
				);
			}
			return null;
		}

		const fullText = getCustomStatusText(normalized);
		const hasEmoji = Boolean(normalized.emojiId || normalized.emojiName);
		const hasText = Boolean(normalized.text);

		if (!hasEmoji && !hasText) {
			return null;
		}

		const emojiResult = hasEmoji
			? renderStatusEmoji(normalized, emojiClassName, animateOnParentHover, alwaysAnimate)
			: null;
		const isEmojiOnly = hasEmoji && !hasText;
		const isSingleLine = maxLines === 1 && !isEmojiOnly;
		const shouldClamp = maxLines > 1 && !isEmojiOnly;
		const clampedStyle: ClampedStyle | undefined = shouldClamp ? {'--max-lines': maxLines} : undefined;

		if (isEditable && onEdit) {
			const isDesktop = !MobileLayoutStore.enabled;
			const shouldShowEmojiTooltip = showTooltip && isDesktop && hasEmoji;

			const renderEditableEmoji = () => {
				if (!emojiResult) {
					return null;
				}

				if (shouldShowEmojiTooltip) {
					return (
						<StatusEmojiWithTooltip status={normalized}>
							{emojiResult.node}
							<span className={styles.hiddenVisually}>{emojiResult.altText}</span>
						</StatusEmojiWithTooltip>
					);
				}

				return (
					<>
						{emojiResult.node}
						<span className={styles.hiddenVisually}>{emojiResult.altText}</span>
					</>
				);
			};

			const editableContent = (
				<FocusRing offset={-2}>
					<button
						type="button"
						className={clsx(styles.editableWrapper, {
							[styles.editableTextHover]: hasText,
							[styles.editableEmojiOnly]: isEmojiOnly,
						})}
						onClick={onEdit}
					>
						<div
							ref={containerRef}
							className={clsx(styles.content, className, {
								[styles.jumbo]: allowJumboEmoji && isEmojiOnly,
								[styles.singleLine]: isSingleLine,
								[styles.clamped]: shouldClamp,
							})}
							style={clampedStyle}
						>
							{renderEditableEmoji()}
							{showText && displayText && <span className={styles.truncatedText}>{displayText}</span>}
						</div>
						{isEmojiOnly && <PencilIcon size={12} weight="bold" className={styles.editPencilIcon} />}
					</button>
				</FocusRing>
			);

			if (showTooltip && fullText && isOverflowing) {
				return <Tooltip text={fullText}>{editableContent}</Tooltip>;
			}

			return editableContent;
		}

		const handleEmojiPress = () => {
			if (!onEmojiPress || !normalized) {
				return;
			}
			const emoji = EmojiStore.getEmojiById(normalized.emojiId ?? '');
			const shouldAnimate = emoji?.animated ?? normalized.emojiAnimated ?? false;
			onEmojiPress({
				id: normalized.emojiId,
				name: normalized.emojiName ?? '',
				animated: shouldAnimate,
			});
		};

		const renderEmojiNode = () => {
			if (!emojiResult) {
				return null;
			}

			const isDesktop = !MobileLayoutStore.enabled;
			const shouldShowEmojiTooltip = showTooltip && isDesktop && hasEmoji;

			if (onEmojiPress && hasEmoji) {
				if (shouldShowEmojiTooltip) {
					return (
						<StatusEmojiWithTooltip status={normalized} onClick={handleEmojiPress} isButton>
							{emojiResult.node}
							<span className={styles.hiddenVisually}>{emojiResult.altText}</span>
						</StatusEmojiWithTooltip>
					);
				}
				return (
					<button type="button" className={styles.emojiPressable} onClick={handleEmojiPress}>
						{emojiResult.node}
						<span className={styles.hiddenVisually}>{emojiResult.altText}</span>
					</button>
				);
			}

			if (shouldShowEmojiTooltip) {
				return (
					<StatusEmojiWithTooltip status={normalized}>
						{emojiResult.node}
						<span className={styles.hiddenVisually}>{emojiResult.altText}</span>
					</StatusEmojiWithTooltip>
				);
			}

			return (
				<span className={styles.emojiTooltipTrigger}>
					{emojiResult.node}
					<span className={styles.hiddenVisually}>{emojiResult.altText}</span>
				</span>
			);
		};

		const content = (
			<div
				ref={containerRef}
				className={clsx(styles.content, className, {
					[styles.jumbo]: allowJumboEmoji && isEmojiOnly,
					[styles.singleLine]: isSingleLine,
					[styles.clamped]: shouldClamp,
					[styles.constrained]: constrained,
				})}
				style={clampedStyle}
			>
				{renderEmojiNode()}
				{showText && displayText && <span className={styles.truncatedText}>{displayText}</span>}
			</div>
		);

		if (showTooltip && fullText && isOverflowing) {
			return <Tooltip text={fullText}>{content}</Tooltip>;
		}

		return content;
	},
);

CustomStatusDisplay.displayName = 'CustomStatusDisplay';
