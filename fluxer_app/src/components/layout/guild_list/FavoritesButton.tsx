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
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import styles from '@app/components/layout/GuildsLayout.module.css';
import {FavoritesGuildContextMenu} from '@app/components/uikit/context_menu/FavoritesGuildContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import {useHover} from '@app/hooks/useHover';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {useLocation} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import {FAVORITES_GUILD_ID} from '@fluxer/constants/src/AppConstants';
import {useLingui} from '@lingui/react/macro';
import {StarIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useRef} from 'react';

interface FavoritesButtonProps {
	className?: string;
}

export const FavoritesButton = observer(({className}: FavoritesButtonProps = {}) => {
	const {t} = useLingui();
	const [hoverRef, isHovering] = useHover();
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const iconRef = useRef<HTMLDivElement | null>(null);
	const itemRef = useRef<HTMLElement | null>(null);
	const mergedButtonRef = useMergeRefs([hoverRef, buttonRef, itemRef]);
	const contextMenuOpen = useContextMenuHoverState(itemRef);
	const location = useLocation();
	const isSelected = location.pathname.startsWith(Routes.FAVORITES);

	const handleSelect = () => {
		const isMobile = MobileLayoutStore.isMobileLayout();

		if (isMobile) {
			NavigationActionCreators.selectChannel(FAVORITES_GUILD_ID);
			return;
		}

		const validChannelId = SelectedChannelStore.getValidatedFavoritesChannel();

		if (validChannelId) {
			NavigationActionCreators.selectChannel(FAVORITES_GUILD_ID, validChannelId);
		} else {
			NavigationActionCreators.selectChannel(FAVORITES_GUILD_ID);
		}
	};

	const handleContextMenu = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		ContextMenuActionCreators.openFromEvent(event, ({onClose}) => <FavoritesGuildContextMenu onClose={onClose} />);
	};

	const shouldShowHoverState = isHovering || contextMenuOpen;
	const indicatorHeight = (() => {
		if (isSelected) return 40;
		if (shouldShowHoverState) return 20;
		return 8;
	})();
	const isActive = shouldShowHoverState || isSelected;

	if (!AccessibilityStore.showFavorites) {
		return null;
	}

	return (
		<Tooltip position="right" size="large" text={t`Favorites`}>
			<FocusRing offset={-2} focusTarget={buttonRef} ringTarget={iconRef}>
				<button
					type="button"
					className={clsx(styles.fluxerButton, contextMenuOpen && styles.contextMenuHover, className)}
					aria-label={t`Favorites`}
					aria-pressed={isSelected}
					data-guild-list-focus-item="true"
					onClick={handleSelect}
					onContextMenu={handleContextMenu}
					ref={mergedButtonRef}
				>
					<AnimatePresence>
						{(isSelected || shouldShowHoverState) && (
							<div className={styles.guildIndicator}>
								<motion.span
									className={styles.guildIndicatorBar}
									initial={false}
									animate={{opacity: 1, scale: 1, height: indicatorHeight}}
									exit={{opacity: 0, scale: 0}}
									transition={{duration: 0.2, ease: [0.25, 0.1, 0.25, 1]}}
								/>
							</div>
						)}
					</AnimatePresence>
					<div className={styles.relative}>
						<motion.div
							ref={iconRef}
							className={clsx(styles.fluxerButtonIcon, isSelected && styles.fluxerButtonIconSelected)}
							animate={{borderRadius: isActive ? '30%' : '50%'}}
							initial={false}
							transition={{duration: 0.07, ease: 'easeOut'}}
							whileHover={{borderRadius: '30%'}}
						>
							<StarIcon weight="fill" className={styles.favoritesIcon} />
						</motion.div>
					</div>
				</button>
			</FocusRing>
		</Tooltip>
	);
});
