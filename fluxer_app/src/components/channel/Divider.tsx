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

import styles from '@app/components/channel/Divider.module.css';
import {Trans} from '@lingui/react/macro';
import {clsx} from 'clsx';
import React from 'react';

export const Divider = React.forwardRef<
	HTMLDivElement,
	{
		red?: boolean;
		children?: React.ReactNode;
		spacing?: number;
		isDate?: boolean;
		style?: React.CSSProperties;
		className?: string;
		id?: string;
		onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
	}
>(({red = false, children, spacing = 8, isDate = false, style, className, ...rest}, ref) => {
	if (red) {
		if (isDate && children) {
			return (
				<div
					ref={ref}
					className={clsx(styles.unreadContainer, styles.unreadDate, className)}
					style={{marginTop: `${spacing}px`, marginBottom: `${spacing}px`, ...style}}
					{...rest}
				>
					<div className={styles.unreadLine} />
					<span className={styles.dateWithUnreadText}>{children}</span>
					<div className={styles.unreadLine} />
					<span className={styles.unreadBadge}>
						<Trans>New</Trans>
					</span>
				</div>
			);
		}

		return (
			<div ref={ref} className={clsx(styles.unreadContainer, className)} style={{...style}} {...rest}>
				<div className={styles.unreadLine} />
				<span className={styles.unreadBadge}>{children || <Trans>New</Trans>}</span>
			</div>
		);
	}

	return (
		<div
			ref={ref}
			className={clsx(styles.container, className)}
			style={{marginTop: `${spacing}px`, marginBottom: `${spacing}px`, ...style}}
			{...rest}
		>
			<div className={styles.line} />
			{children && <span className={clsx(styles.text, 'text')}>{children}</span>}
			<div className={styles.line} />
		</div>
	);
});

Divider.displayName = 'Divider';
