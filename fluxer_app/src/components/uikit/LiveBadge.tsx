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

import styles from '@app/components/uikit/LiveBadge.module.css';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';

interface LiveBadgeProps {
	className?: string;
	showTooltip?: boolean;
}

export function LiveBadge({className, showTooltip = true}: LiveBadgeProps) {
	const {t} = useLingui();

	const badge = <span className={clsx(styles.liveBadge, className)}>{t`Live`}</span>;

	if (showTooltip) {
		return <Tooltip text={t`Screen Sharing`}>{badge}</Tooltip>;
	}

	return badge;
}
