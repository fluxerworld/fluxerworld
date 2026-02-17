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

import styles from '@app/components/layout/ChannelItem.module.css';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useTextOverflow} from '@app/hooks/useTextOverflow';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useRef} from 'react';

interface ChannelItemContentProps {
	icon?: React.ReactNode;
	name: string;
	actions?: React.ReactNode;
	isCategory?: boolean;
	nameClassName?: string;
}

export const ChannelItemContent: React.FC<ChannelItemContentProps> = observer(
	({icon, name, actions, isCategory = false, nameClassName}) => {
		const nameRef = useRef<HTMLSpanElement>(null);
		const isNameOverflowing = useTextOverflow(nameRef);

		if (isCategory) {
			return (
				<>
					<div className={styles.categoryContent}>
						<Tooltip text={isNameOverflowing && name ? name : ''}>
							<span ref={nameRef} className={clsx(styles.categoryName, nameClassName)}>
								{name}
							</span>
						</Tooltip>
					</div>
					{actions && <div className={styles.channelItemActions}>{actions}</div>}
				</>
			);
		}

		return (
			<>
				{icon && (
					<Tooltip text={name}>
						<div>{icon}</div>
					</Tooltip>
				)}
				<Tooltip text={isNameOverflowing && name ? name : ''}>
					<span ref={nameRef} className={clsx(styles.channelName, nameClassName)}>
						{name}
					</span>
				</Tooltip>
				{actions && <div className={styles.channelItemActions}>{actions}</div>}
			</>
		);
	},
);
