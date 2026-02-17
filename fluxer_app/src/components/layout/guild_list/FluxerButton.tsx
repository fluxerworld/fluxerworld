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

import {FluxerSymbol} from '@app/components/icons/FluxerSymbol';
import styles from '@app/components/layout/GuildsLayout.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {MentionBadgeAnimated} from '@app/components/uikit/MentionBadge';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useHover} from '@app/hooks/useHover';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {useLocation} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import * as RouterUtils from '@app/utils/RouterUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {useRef} from 'react';

export const FluxerButton = observer(() => {
	const {t} = useLingui();
	const [hoverRef, isHovering] = useHover();
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const iconRef = useRef<HTMLDivElement | null>(null);
	const mergedButtonRef = useMergeRefs([hoverRef, buttonRef]);
	const location = useLocation();
	const isSelected = location.pathname.startsWith(Routes.ME) || Routes.isSpecialPage(location.pathname);
	const selectedChannel = SelectedChannelStore.selectedChannelIds.get(ME);

	const relationships = RelationshipStore.getRelationships();

	const pendingRequests = Object.values(relationships).filter(
		({type}) => type === RelationshipTypes.INCOMING_REQUEST,
	).length;

	const handleSelect = () => {
		const isMobile = MobileLayoutStore.isMobileLayout();
		const route = (() => {
			if (isMobile) return Routes.ME;
			if (selectedChannel) return Routes.dmChannel(selectedChannel);
			return Routes.ME;
		})();
		RouterUtils.transitionTo(route);
	};

	const indicatorHeight = (() => {
		if (isSelected) return 40;
		if (isHovering) return 20;
		return 8;
	})();
	const isActive = isHovering || isSelected;

	return (
		<Tooltip position="right" size="large" text={t`Direct Messages`}>
			<FocusRing offset={-2} focusTarget={buttonRef} ringTarget={iconRef}>
				<button
					type="button"
					className={styles.fluxerButton}
					aria-label={t`Direct Messages`}
					aria-pressed={isSelected}
					data-guild-list-focus-item="true"
					onClick={handleSelect}
					ref={mergedButtonRef}
				>
					<AnimatePresence>
						{(isSelected || isHovering) && (
							<div className={styles.guildIndicator}>
								<motion.span
									className={styles.guildIndicatorBar}
									initial={false}
									animate={{opacity: 1, scale: 1, height: indicatorHeight}}
									exit={{opacity: 0, scale: 0, height: 0}}
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
							<FluxerSymbol className={styles.fluxerSymbolIcon} />
						</motion.div>

						<div className={clsx(styles.guildBadge, pendingRequests > 0 && styles.guildBadgeActive)}>
							<MentionBadgeAnimated mentionCount={pendingRequests} size="small" />
						</div>
					</div>
				</button>
			</FocusRing>
		</Tooltip>
	);
});
