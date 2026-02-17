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

import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import styles from '@app/components/channel/MessageUploadProgress.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {useMessageUpload} from '@app/hooks/useCloudUpload';
import {CloudUpload} from '@app/lib/CloudUpload';
import {Logger} from '@app/lib/Logger';
import type {MessageRecord} from '@app/records/MessageRecord';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {formatFileSize} from '@app/utils/FileUtils';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {FileIcon, XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

const logger = new Logger('MessageUploadProgress');

interface MessageUploadProgressProps {
	attachment: MessageAttachment;
	message: MessageRecord;
}

export const MessageUploadProgress = observer(({attachment, message}: MessageUploadProgressProps) => {
	const {t} = useLingui();
	const {enabled: isMobile} = MobileLayoutStore;
	const messageUpload = useMessageUpload(message.nonce || '');

	const resolveProgress = (): number | null => {
		if (!messageUpload) return null;

		if (typeof messageUpload.sendingProgress === 'number') {
			return Math.round(messageUpload.sendingProgress);
		}

		if (!messageUpload.attachments.length) return null;

		const withProgress = messageUpload.attachments.filter(
			(att) => att.uploadProgress !== undefined && att.status !== 'failed',
		);

		if (!withProgress.length) {
			return null;
		}

		const total = withProgress.reduce((sum, att) => sum + (att.uploadProgress ?? 0), 0);
		return Math.round(total / withProgress.length);
	};

	const hasFailedUploads = (): boolean => {
		if (!messageUpload) return false;
		return messageUpload.attachments.some((att) => att.status === 'failed');
	};

	const handleCancel = async () => {
		if (!message.nonce || !messageUpload) return;

		try {
			await Promise.all(messageUpload.attachments.map((att) => CloudUpload.cancelUpload(att.id)));
		} catch (error) {
			logger.error('Failed to cancel some uploads:', error);
		}

		CloudUpload.removeMessageUpload(message.nonce);
		MessageActionCreators.deleteOptimistic(message.channelId, message.id);
	};

	const progress = resolveProgress();
	const failed = hasFailedUploads();

	const fileName = attachment.filename;
	const fileSize = formatFileSize(attachment.size);
	const isIndeterminate = progress === null;
	const progressValue = progress ?? 0;

	const containerStyles: React.CSSProperties = isMobile
		? {
				display: 'grid',
				width: '100%',
				maxWidth: '100%',
				minWidth: 0,
			}
		: {
				display: 'grid',
				width: '400px',
				maxWidth: '400px',
			};

	return (
		<div style={containerStyles}>
			<div className={styles.container}>
				<div className={styles.iconContainer}>
					<FileIcon size={32} />
				</div>
				<div className={styles.content}>
					<p className={styles.fileName}>{fileName}</p>
					<p className={styles.fileSize}>{fileSize}</p>
					<div className={styles.progressContainer}>
						{isIndeterminate ? (
							<div className={styles.progressBarIndeterminate} />
						) : (
							<div
								className={`${styles.progressBar} ${failed ? styles.progressBarFailed : styles.progressBarNormal}`}
								style={{width: `${progressValue}%`}}
							/>
						)}
					</div>
				</div>
				<FocusRing offset={-2}>
					<button type="button" onClick={handleCancel} className={styles.cancelButton} aria-label={t`Cancel upload`}>
						<XIcon size={20} weight="bold" />
					</button>
				</FocusRing>
			</div>
		</div>
	);
});
