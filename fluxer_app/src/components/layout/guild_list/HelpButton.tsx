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

import guildStyles from '@app/components/layout/GuildsLayout.module.css';
import styles from '@app/components/layout/guild_list/HelpButton.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {TooltipWithKeybind} from '@app/components/uikit/keybind_hint/KeybindHint';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useHover} from '@app/hooks/useHover';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {Routes} from '@app/Routes';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {useLingui} from '@lingui/react/macro';
import {QuestionMarkIcon} from '@phosphor-icons/react';
import {motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {useRef} from 'react';

export const HelpButton = observer(() => {
	const {t} = useLingui();
	const [hoverRef, isHovering] = useHover();
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const iconRef = useRef<HTMLDivElement | null>(null);
	const mergedButtonRef = useMergeRefs([hoverRef, buttonRef]);

	const handleHelp = () => {
		openExternalUrl(Routes.help());
	};

	return (
		<div className={guildStyles.addGuildButton}>
			<Tooltip
				position="right"
				size="large"
				text={() => <TooltipWithKeybind label={t`Help Center`} action="get_help" />}
			>
				<FocusRing offset={-2} focusTarget={buttonRef} ringTarget={iconRef}>
					<button
						type="button"
						aria-label={t`Help Center`}
						data-guild-list-focus-item="true"
						onClick={handleHelp}
						className={styles.button}
						ref={mergedButtonRef}
					>
						<motion.div
							ref={iconRef}
							className={guildStyles.addGuildButtonIcon}
							animate={{borderRadius: isHovering ? '30%' : '50%'}}
							initial={{borderRadius: isHovering ? '30%' : '50%'}}
							transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.07, ease: 'easeOut'}}
							whileHover={AccessibilityStore.useReducedMotion ? undefined : {borderRadius: '30%'}}
						>
							<QuestionMarkIcon weight="bold" className={styles.iconText} />
						</motion.div>
					</button>
				</FocusRing>
			</Tooltip>
		</div>
	);
});
