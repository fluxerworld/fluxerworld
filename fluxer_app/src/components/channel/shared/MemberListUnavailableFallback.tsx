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

import styles from '@app/components/channel/shared/MemberListUnavailableFallback.module.css';
import {useLingui} from '@lingui/react/macro';
import {UsersIcon} from '@phosphor-icons/react';

interface MemberListUnavailableFallbackProps {
	className?: string;
}

export function MemberListUnavailableFallback({className}: MemberListUnavailableFallbackProps) {
	const {t} = useLingui();
	const containerClassName = className ? `${styles.container} ${className}` : styles.container;

	return (
		<div className={containerClassName}>
			<div className={styles.content}>
				<UsersIcon className={styles.icon} weight="fill" />
				<h3 className={styles.title}>{t`Member List Unavailable`}</h3>
				<p className={styles.description}>{t`Member lists are temporarily unavailable in this community`}</p>
			</div>
		</div>
	);
}
