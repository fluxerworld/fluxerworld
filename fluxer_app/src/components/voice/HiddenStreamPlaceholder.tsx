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

import styles from '@app/components/voice/HiddenStreamPlaceholder.module.css';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import type React from 'react';
import {useMemo} from 'react';

interface HiddenStreamPlaceholderProps {
	className?: string;
	label?: string;
}

export function HiddenStreamPlaceholder({className, label}: HiddenStreamPlaceholderProps): React.ReactElement {
	const {t} = useLingui();
	const displayLabel = useMemo(() => label ?? t`Preview hidden`, [label, t]);

	return (
		<div className={clsx(styles.root, className)}>
			<span className={styles.label}>{displayLabel}</span>
		</div>
	);
}
