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

import {ChannelSourcePreview} from '@app/components/channel/ChannelSourcePreview';
import styles from '@app/components/popouts/InboxMessageHeader.module.css';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {MediaProxyImageSize} from '@fluxer/constants/src/MediaProxyImageSizes';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface InboxMessageHeaderProps {
	channel: ChannelRecord;
	onClick?: () => void;
	leftAdornment?: React.ReactNode;
	rightActions?: React.ReactNode;
	mentionCount?: number;
	avatarSize?: MediaProxyImageSize;
}

export const InboxMessageHeader = observer(function InboxMessageHeader({
	channel,
	onClick,
	leftAdornment,
	rightActions,
	mentionCount,
	avatarSize = 32,
}: InboxMessageHeaderProps) {
	return (
		<div className={styles.header}>
			<div className={styles.headerLeft}>
				{leftAdornment}
				<ChannelSourcePreview channel={channel} onClick={onClick} mentionCount={mentionCount} avatarSize={avatarSize} />
			</div>
			{rightActions && <div className={styles.headerActions}>{rightActions}</div>}
		</div>
	);
});
