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

import {EmojiInfoBottomSheet} from '@app/components/bottomsheets/EmojiInfoBottomSheet';
import {EmojiInfoContent} from '@app/components/emojis/EmojiInfoContent';
import {EmojiTooltipContent} from '@app/components/uikit/emoji_tooltip_content/EmojiTooltipContent';
import {useTooltipPortalRoot} from '@app/components/uikit/tooltip/Tooltip';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {useReactionTooltip} from '@app/hooks/useReactionTooltip';
import type {RendererProps} from '@app/lib/markdown/renderers/RendererTypes';
import {getEmojiRenderData} from '@app/lib/markdown/utils/EmojiDetector';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import EmojiStore from '@app/stores/EmojiStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {getReducedMotionProps, TOOLTIP_MOTION} from '@app/utils/ReducedMotionAnimation';
import {setUrlQueryParams} from '@app/utils/UrlUtils';
import {FloatingPortal} from '@floating-ui/react';
import {EmojiKind} from '@fluxer/markdown_parser/src/types/Enums';
import type {EmojiNode} from '@fluxer/markdown_parser/src/types/Nodes';
import {msg} from '@lingui/core/macro';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useState} from 'react';

interface EmojiBottomSheetState {
	isOpen: boolean;
	emoji: {id?: string; name: string; animated?: boolean} | null;
}

interface EmojiWithTooltipProps {
	children: React.ReactElement<Record<string, unknown> & {ref?: React.Ref<HTMLElement>}>;
	emojiUrl: string | null;
	nativeEmoji?: React.ReactNode;
	emojiName: string;
	emojiForSubtext: FlatEmoji;
}

const EmojiWithTooltip = observer(
	({children, emojiUrl, nativeEmoji, emojiName, emojiForSubtext}: EmojiWithTooltipProps) => {
		const tooltipPortalRoot = useTooltipPortalRoot();
		const tooltipMotion = getReducedMotionProps(TOOLTIP_MOTION, AccessibilityStore.useReducedMotion);
		const {targetRef, tooltipRef, state, updatePosition, handlers, tooltipHandlers} = useReactionTooltip(500);

		const childRef = children.props.ref ?? null;
		const mergedRef = useMergeRefs([targetRef, childRef]);

		return (
			<>
				{React.cloneElement(children, {
					ref: mergedRef,
					...handlers,
				} as Record<string, unknown>)}
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
									emoji={nativeEmoji}
									emojiUrl={emojiUrl}
									emojiAlt={emojiName}
									primaryContent={emojiName}
									subtext={<EmojiInfoContent emoji={emojiForSubtext} />}
								/>
							</motion.div>
						</AnimatePresence>
					</FloatingPortal>
				)}
			</>
		);
	},
);

const EmojiRendererInner = observer(function EmojiRendererInner({
	node,
	id,
	options,
}: RendererProps<EmojiNode>): React.ReactElement {
	const {shouldJumboEmojis, guildId, messageId, disableAnimatedEmoji} = options;
	const i18n = options.i18n!;
	const emojiData = getEmojiRenderData(node, guildId, disableAnimatedEmoji);
	const isMobile = MobileLayoutStore.enabled;

	const [bottomSheetState, setBottomSheetState] = useState<EmojiBottomSheetState>({
		isOpen: false,
		emoji: null,
	});

	const className = clsx('emoji', shouldJumboEmojis && 'jumboable');

	const size = shouldJumboEmojis ? 240 : 96;
	const tooltipEmojiSize = 240;
	const renderedEmojiUrl =
		emojiData.id && emojiData.url ? setUrlQueryParams(emojiData.url, {size, quality: 'lossless'}) : emojiData.url;
	const tooltipEmojiUrl =
		emojiData.id && emojiData.url
			? setUrlQueryParams(emojiData.url, {size: tooltipEmojiSize, quality: 'lossless'})
			: emojiData.url;

	const isCustomEmoji = node.kind.kind === EmojiKind.Custom;
	const emojiRecord: FlatEmoji | null =
		isCustomEmoji && emojiData.id ? (EmojiStore.getEmojiById(emojiData.id) ?? null) : null;
	const fallbackGuildId = emojiRecord?.guildId;
	const fallbackAnimated = emojiRecord?.animated ?? emojiData.isAnimated;

	const handleOpenBottomSheet = useCallback(() => {
		if (!isMobile) return;

		const emojiInfo = {
			name: node.kind.name,
			id: isCustomEmoji ? (node.kind as {id: string}).id : undefined,
			animated: isCustomEmoji ? (node.kind as {animated: boolean}).animated : false,
		};

		setBottomSheetState({isOpen: true, emoji: emojiInfo});
	}, [isMobile, node.kind, isCustomEmoji]);

	const handleCloseBottomSheet = useCallback(() => {
		setBottomSheetState({isOpen: false, emoji: null});
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				handleOpenBottomSheet();
			}
		},
		[handleOpenBottomSheet],
	);

	const buildEmojiForSubtext = useCallback((): FlatEmoji => {
		if (emojiRecord) {
			return emojiRecord;
		}

		return {
			id: emojiData.id,
			guildId: fallbackGuildId,
			animated: fallbackAnimated,
			name: node.kind.name,
			allNamesString: node.kind.name,
			uniqueName: node.kind.name,
		};
	}, [emojiData.id, emojiData.isAnimated, emojiRecord, node.kind.name]);

	const getTooltipData = useCallback(() => {
		const emojiUrl = shouldUseNativeEmoji && node.kind.kind === EmojiKind.Standard ? null : tooltipEmojiUrl;

		const nativeEmoji =
			shouldUseNativeEmoji && node.kind.kind === EmojiKind.Standard ? (
				<span className={clsx('emoji', 'jumboable')}>{node.kind.raw}</span>
			) : undefined;

		const emojiForSubtext = buildEmojiForSubtext();

		return {emojiUrl, nativeEmoji, emojiForSubtext};
	}, [buildEmojiForSubtext, node.kind.kind, tooltipEmojiUrl]);

	const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
		const target = e.target as HTMLImageElement;
		target.style.opacity = '0.5';
		target.alt = `${emojiData.name} ${i18n._(msg`(failed to load)`)}`;
	};

	if (shouldUseNativeEmoji && node.kind.kind === EmojiKind.Standard) {
		if (isMobile) {
			return (
				<>
					<span
						className={className}
						data-message-id={messageId}
						data-message-emoji="true"
						onClick={handleOpenBottomSheet}
						onKeyDown={handleKeyDown}
						role="button"
						tabIndex={0}
					>
						{node.kind.raw}
					</span>
					<EmojiInfoBottomSheet
						isOpen={bottomSheetState.isOpen}
						onClose={handleCloseBottomSheet}
						emoji={bottomSheetState.emoji}
					/>
				</>
			);
		}

		const tooltipData = getTooltipData();
		return (
			<EmojiWithTooltip
				key={id}
				emojiUrl={tooltipData.emojiUrl}
				nativeEmoji={tooltipData.nativeEmoji}
				emojiName={emojiData.name}
				emojiForSubtext={tooltipData.emojiForSubtext}
			>
				<span className={className} data-message-id={messageId} data-message-emoji="true">
					{node.kind.raw}
				</span>
			</EmojiWithTooltip>
		);
	}

	if (isMobile) {
		return (
			<>
				<span onClick={handleOpenBottomSheet} onKeyDown={handleKeyDown} role="button" tabIndex={0}>
					<img
						draggable={false}
						className={className}
						alt={emojiData.name}
						src={renderedEmojiUrl ?? undefined}
						data-message-id={messageId}
						data-message-emoji="true"
						data-emoji-id={emojiData.id}
						data-animated={emojiData.isAnimated}
						onError={handleImageError}
						loading="lazy"
					/>
				</span>
				<EmojiInfoBottomSheet
					isOpen={bottomSheetState.isOpen}
					onClose={handleCloseBottomSheet}
					emoji={bottomSheetState.emoji}
				/>
			</>
		);
	}

	const tooltipData = getTooltipData();
	return (
		<EmojiWithTooltip
			key={id}
			emojiUrl={tooltipData.emojiUrl}
			nativeEmoji={tooltipData.nativeEmoji}
			emojiName={emojiData.name}
			emojiForSubtext={tooltipData.emojiForSubtext}
		>
			<img
				draggable={false}
				className={className}
				alt={emojiData.name}
				src={renderedEmojiUrl ?? undefined}
				data-message-id={messageId}
				data-message-emoji="true"
				data-emoji-id={emojiData.id}
				data-animated={emojiData.isAnimated}
				onError={handleImageError}
				loading="lazy"
			/>
		</EmojiWithTooltip>
	);
});

export const EmojiRenderer = EmojiRendererInner;
