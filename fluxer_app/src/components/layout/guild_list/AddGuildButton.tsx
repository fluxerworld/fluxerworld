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
import guildStyles from '@app/components/layout/GuildsLayout.module.css';
import styles from '@app/components/layout/guild_list/AddGuildButton.module.css';
import {AddGuildModal, type AddGuildModalView} from '@app/components/modals/AddGuildModal';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {TooltipWithKeybind} from '@app/components/uikit/keybind_hint/KeybindHint';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import {useHover} from '@app/hooks/useHover';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {HouseIcon, LinkIcon, PlusIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useRef} from 'react';

export const AddGuildButton = observer(() => {
	const {t} = useLingui();
	const [hoverRef, isHovering] = useHover();
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const iconRef = useRef<HTMLDivElement | null>(null);
	const itemRef = useRef<HTMLElement | null>(null);
	const contextMenuOpen = useContextMenuHoverState(itemRef);
	const mergedButtonRef = useMergeRefs([hoverRef, buttonRef, itemRef]);

	const handleAddGuild = (view?: AddGuildModalView) => {
		ModalActionCreators.push(modal(() => <AddGuildModal initialView={view} />));
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
			<MenuGroup>
				<MenuItem
					icon={<HouseIcon className={styles.menuIcon} />}
					onClick={() => {
						handleAddGuild('create_guild');
						onClose();
					}}
				>
					<Trans>Create Community</Trans>
				</MenuItem>
				<MenuItem
					icon={<LinkIcon className={styles.menuIcon} weight="bold" />}
					onClick={() => {
						handleAddGuild('join_guild');
						onClose();
					}}
				>
					<Trans>Join Community</Trans>
				</MenuItem>
			</MenuGroup>
		));
	};

	const shouldShowHoverState = isHovering || contextMenuOpen;

	return (
		<div className={clsx(guildStyles.addGuildButton, contextMenuOpen && guildStyles.contextMenuHover)}>
			<Tooltip
				position="right"
				size="large"
				text={() => <TooltipWithKeybind label={t`Add a Community`} action="create_or_join_server" />}
			>
				<FocusRing offset={-2} focusTarget={buttonRef} ringTarget={iconRef}>
					<button
						type="button"
						aria-label={t`Add a Community`}
						data-guild-list-focus-item="true"
						onClick={() => handleAddGuild()}
						onContextMenu={handleContextMenu}
						className={styles.button}
						ref={mergedButtonRef}
					>
						<motion.div
							ref={iconRef}
							className={guildStyles.addGuildButtonIcon}
							animate={{borderRadius: shouldShowHoverState ? '30%' : '50%'}}
							initial={{borderRadius: shouldShowHoverState ? '30%' : '50%'}}
							transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.07, ease: 'easeOut'}}
							whileHover={AccessibilityStore.useReducedMotion ? undefined : {borderRadius: '30%'}}
						>
							<PlusIcon weight="bold" className={styles.iconText} />
						</motion.div>
					</button>
				</FocusRing>
			</Tooltip>
		</div>
	);
});
