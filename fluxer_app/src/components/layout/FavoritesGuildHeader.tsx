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
import {FavoritesGuildHeaderBottomSheet} from '@app/components/bottomsheets/FavoritesGuildHeaderBottomSheet';
import styles from '@app/components/layout/FavoritesGuildHeader.module.css';
import guildHeaderStyles from '@app/components/layout/GuildHeader.module.css';
import {GuildHeaderShell} from '@app/components/layout/GuildHeaderShell';
import {FavoritesGuildHeaderPopout} from '@app/components/popouts/FavoritesGuildHeaderPopout';
import {FavoritesGuildContextMenu} from '@app/components/uikit/context_menu/FavoritesGuildContextMenu';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import PopoutStore from '@app/stores/PopoutStore';
import {useLingui} from '@lingui/react/macro';
import {CaretDownIcon, DotsThreeIcon, StarIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useRef} from 'react';

export const FavoritesGuildHeader = observer(() => {
	const {t} = useLingui();
	const {popouts} = PopoutStore;
	const isOpen = 'favorites-guild-header' in popouts;
	const isMobile = MobileLayoutStore.isMobileLayout();
	const mobileHeaderRef = useRef<HTMLDivElement | null>(null);

	const handleContextMenu = useCallback((event: React.MouseEvent) => {
		ContextMenuActionCreators.openFromEvent(event, ({onClose}) => <FavoritesGuildContextMenu onClose={onClose} />);
	}, []);

	return (
		<div
			className={clsx(
				guildHeaderStyles.headerContainer,
				guildHeaderStyles.headerContainerNoBanner,
				isOpen && guildHeaderStyles.headerContainerActive,
			)}
			style={{height: 56}}
		>
			<GuildHeaderShell
				popoutId="favorites-guild-header"
				renderPopout={() => <FavoritesGuildHeaderPopout />}
				renderBottomSheet={({isOpen, onClose}) => <FavoritesGuildHeaderBottomSheet isOpen={isOpen} onClose={onClose} />}
				onContextMenu={handleContextMenu}
				className={guildHeaderStyles.headerContent}
				triggerRef={mobileHeaderRef}
			>
				{(isOpen) => (
					<>
						<div className={styles.headerIconContainer}>
							<StarIcon weight="fill" className={clsx(guildHeaderStyles.verifiedIconDefault, styles.headerIcon)} />
							<span className={guildHeaderStyles.guildNameDefault}>{t`Favorites`}</span>
						</div>
						{isMobile ? (
							<DotsThreeIcon weight="bold" className={guildHeaderStyles.dotsIconDefault} />
						) : (
							<CaretDownIcon
								weight="bold"
								className={clsx(guildHeaderStyles.caretIconDefault, isOpen && guildHeaderStyles.caretIconOpen)}
							/>
						)}
					</>
				)}
			</GuildHeaderShell>
		</div>
	);
});
