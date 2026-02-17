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

import styles from '@app/components/uikit/alt_text_tooltip/AltTextTooltip.module.css';
import {EmojiTooltipContent} from '@app/components/uikit/emoji_tooltip_content/EmojiTooltipContent';
import {useTooltipPortalRoot} from '@app/components/uikit/tooltip/Tooltip';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {useReactionTooltip} from '@app/hooks/useReactionTooltip';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {getReducedMotionProps, TOOLTIP_MOTION} from '@app/utils/ReducedMotionAnimation';
import {FloatingPortal} from '@floating-ui/react';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useEffect} from 'react';

interface AltTextTooltipProps {
	altText: string;
	children: React.ReactElement<{ref?: React.Ref<HTMLElement>}>;
	onPopoutToggle?: (open: boolean) => void;
}

export const AltTextTooltip: React.FC<AltTextTooltipProps> = observer(({altText, children, onPopoutToggle}) => {
	const portalRoot = useTooltipPortalRoot();
	const tooltipMotion = getReducedMotionProps(TOOLTIP_MOTION, AccessibilityStore.useReducedMotion);
	const {targetRef, tooltipRef, state, updatePosition, handlers, tooltipHandlers} = useReactionTooltip(200, 'top-end');

	const child = React.Children.only(children);
	const mergedRef = useMergeRefs([targetRef, child.props.ref]);
	useEffect(() => {
		if (!onPopoutToggle) {
			return;
		}
		onPopoutToggle(state.isOpen);
	}, [onPopoutToggle, state.isOpen]);
	const stopPropagation = useCallback((event: React.SyntheticEvent) => {
		event.stopPropagation();
	}, []);

	return (
		<>
			{React.cloneElement(child, {
				ref: mergedRef,
				...handlers,
			})}
			{portalRoot && (
				<FloatingPortal root={portalRoot}>
					<AnimatePresence>
						{state.isOpen && (
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
								onMouseDown={stopPropagation}
								onTouchStart={stopPropagation}
								onClick={stopPropagation}
							>
								<EmojiTooltipContent
									className={styles.tooltip}
									primaryContent={<span className={styles.text}>{altText}</span>}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</FloatingPortal>
			)}
		</>
	);
});
