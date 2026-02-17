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

import styles from '@app/components/auth/AuthPageStyles.module.css';
import {GuildBadge} from '@app/components/guild/GuildBadge';
import type {ReactNode} from 'react';

interface AuthPageHeaderStatProps {
	value: string | number;
	dot?: 'online' | 'offline';
}

interface AuthPageHeaderProps {
	icon: ReactNode;
	title: string;
	subtitle: string;
	features?: ReadonlyArray<string>;
	stats?: Array<AuthPageHeaderStatProps>;
}

export function AuthPageHeader({icon, title, subtitle, features, stats}: AuthPageHeaderProps) {
	return (
		<div className={styles.entityHeader}>
			{icon}
			<div className={styles.entityDetails}>
				<p className={styles.entityText}>{title}</p>
				<div className={styles.entityTitleWrapper}>
					<h2 className={styles.entityTitle}>{subtitle}</h2>
					{features && <GuildBadge features={features} />}
				</div>
				{stats && stats.length > 0 && (
					<div className={styles.entityStats}>
						{stats.map((stat, index) => (
							<div key={index} className={styles.entityStat}>
								{stat.dot === 'online' && <div className={styles.onlineDot} />}
								{stat.dot === 'offline' && <div className={styles.offlineDot} />}
								<span className={styles.statText}>{stat.value}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
