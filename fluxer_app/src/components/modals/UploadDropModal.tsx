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

import styles from '@app/components/modals/UploadDropModal.module.css';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {useLingui} from '@lingui/react/macro';
import {ArrowFatUpIcon, FileIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';

interface UploadDropModalProps {
	channel: ChannelRecord;
	isShiftHeld: boolean;
	isSlowmodeActive: boolean;
}

export const UploadDropModal = ({channel, isShiftHeld, isSlowmodeActive}: UploadDropModalProps) => {
	const {t} = useLingui();
	const displayName = channel.isPrivate()
		? ChannelUtils.getDMDisplayName(channel)
		: channel.name
			? `#${channel.name}`
			: t`Unknown Channel`;

	return (
		<div className={styles.overlay}>
			<div className={styles.dialog}>
				<div className={styles.dialogIconCircle}>
					<FileIcon className={styles.dialogIcon} weight="fill" />
				</div>

				<div className={styles.dialogTextBlock}>
					<h2 className={styles.dialogTitle}>
						{isShiftHeld ? t`Upload directly to ${displayName}` : t`Upload to ${displayName}`}
					</h2>
					<p className={styles.dialogDescription}>
						{isShiftHeld
							? t`Files will be sent immediately without preview.`
							: isSlowmodeActive
								? t`You can add comments before uploading. Direct upload is disabled during slowmode.`
								: t`You can add comments before uploading. Hold shift to upload directly.`}
					</p>
				</div>

				<div
					className={clsx(styles.statusBanner, isShiftHeld ? styles.statusBannerActive : styles.statusBannerDefault)}
				>
					<div className={clsx(styles.statusIndicator, isShiftHeld && styles.statusIndicatorActive)}>
						<ArrowFatUpIcon className={styles.statusIcon} weight="fill" />
					</div>
					<span>{isShiftHeld ? t`Direct upload active` : t`Hold for instant upload`}</span>
				</div>
			</div>
		</div>
	);
};
