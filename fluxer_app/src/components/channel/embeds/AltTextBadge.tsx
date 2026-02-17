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

import styles from '@app/components/channel/embeds/AltTextBadge.module.css';
import {AltTextTooltip} from '@app/components/uikit/alt_text_tooltip/AltTextTooltip';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import type {FC} from 'react';

interface AltTextBadgeProps {
	altText?: string | null;
	onPopoutToggle?: (open: boolean) => void;
}

const getAltBadgeText = (altText?: string | null): string | null => {
	if (!altText) return null;
	const trimmed = altText.trim();
	return trimmed.length > 0 ? trimmed : null;
};

export const AltTextBadge: FC<AltTextBadgeProps> = ({altText, onPopoutToggle}) => {
	const badgeText = getAltBadgeText(altText);
	if (!badgeText) return null;

	return (
		<div className={styles.wrapper}>
			<AltTextTooltip altText={badgeText} onPopoutToggle={onPopoutToggle}>
				<FocusRing offset={-2}>
					<button type="button" className={styles.button} aria-label={badgeText}>
						ALT
					</button>
				</FocusRing>
			</AltTextTooltip>
		</div>
	);
};
