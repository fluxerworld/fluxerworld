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

import {Button} from '@app/components/uikit/button/Button';
import styles from '@app/components/voice/FeedHiddenOverlay.module.css';
import {MonitorPlayIcon} from '@phosphor-icons/react';
import type React from 'react';

interface FeedHiddenOverlayProps {
	message: string;
	buttonLabel: string;
	onReveal: (event: React.SyntheticEvent) => void;
}

export function FeedHiddenOverlay({message, buttonLabel, onReveal}: FeedHiddenOverlayProps) {
	return (
		<div className={styles.feedHiddenOverlay}>
			<span className={styles.feedHiddenText}>{message}</span>
			<Button
				variant="secondary"
				fitContent
				leftIcon={<MonitorPlayIcon size={18} weight="fill" />}
				onClick={onReveal}
				className={styles.feedHiddenButton}
			>
				{buttonLabel}
			</Button>
		</div>
	);
}
