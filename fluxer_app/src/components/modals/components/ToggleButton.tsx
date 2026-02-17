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

import styles from '@app/components/modals/components/ToggleButton.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const ToggleButton: React.FC<{active: boolean; onClick: () => void; label: React.ReactNode}> = observer(
	({active, onClick, label}) => (
		<FocusRing offset={-2}>
			<button
				type="button"
				aria-pressed={active}
				className={clsx(styles.button, active ? styles.active : styles.inactive)}
				onClick={onClick}
			>
				{label}
			</button>
		</FocusRing>
	),
);
