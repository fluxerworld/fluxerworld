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

import {AttachmentLayoutGrid} from '@app/components/channel/embeds/attachments/AttachmentLayoutGrid';
import {AttachmentSingleMedia} from '@app/components/channel/embeds/attachments/AttachmentSingleMedia';
import {ExpiryFootnote} from '@app/components/common/ExpiryFootnote';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import styles from '@app/styles/AttachmentMosaic.module.css';
import {formatAttachmentDate, getEarliestAttachmentExpiry} from '@app/utils/AttachmentExpiryUtils';
import {getMosaicMediaDimensions} from '@app/utils/MediaDimensionConfig';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type {CSSProperties, FC} from 'react';
import {useMemo} from 'react';

export interface AttachmentMosaicProps {
	attachments: ReadonlyArray<MessageAttachment>;
	message?: MessageRecord;
	hideExpiryFootnote?: boolean;
	isPreview?: boolean;
	onDelete?: (bypassConfirm?: boolean) => void;
}

interface AttachmentMosaicStyle extends CSSProperties {
	'--attachment-media-max-height': string;
	'--attachment-media-max-width': string;
}

const isImageType = (contentType?: string): boolean => contentType?.startsWith('image/') ?? false;
const isVideoType = (contentType?: string): boolean => contentType?.startsWith('video/') ?? false;

const isMediaAttachment = (attachment: MessageAttachment): boolean => {
	if (!attachment.width || !attachment.height) return false;
	return isImageType(attachment.content_type) || isVideoType(attachment.content_type);
};

const AttachmentMosaicComponent: FC<AttachmentMosaicProps> = observer(
	({attachments, message, hideExpiryFootnote, isPreview, onDelete}) => {
		const {t} = useLingui();

		const mediaAttachments = useMemo(() => attachments.filter(isMediaAttachment), [attachments]);
		const mosaicDimensions = getMosaicMediaDimensions(message);
		const mosaicStyle: AttachmentMosaicStyle = {
			'--attachment-media-max-height': `${mosaicDimensions.maxHeight}px`,
			'--attachment-media-max-width': `${mosaicDimensions.maxWidth}px`,
		};

		if (mediaAttachments.length === 0) {
			return null;
		}

		const aggregateExpiry = getEarliestAttachmentExpiry(attachments);

		const renderFootnote = () => {
			if (hideExpiryFootnote) {
				return null;
			}

			const earliest = formatAttachmentDate(aggregateExpiry.expiresAt);
			const latest = formatAttachmentDate(aggregateExpiry.latestAt);

			let label: string;
			if (earliest && latest && earliest !== latest) {
				label = aggregateExpiry.isExpired
					? t`Expired between ${earliest} and ${latest}`
					: t`Expires between ${earliest} and ${latest}`;
			} else if (earliest) {
				label = aggregateExpiry.isExpired ? t`Expired on ${earliest}` : t`Expires on ${earliest}`;
			} else {
				return null;
			}

			return AccessibilityStore.showAttachmentExpiryIndicator ? (
				<ExpiryFootnote expiresAt={aggregateExpiry.expiresAt} isExpired={aggregateExpiry.isExpired} label={label} />
			) : null;
		};

		return (
			<div className={styles.mosaicContainerWrapper} style={mosaicStyle}>
				<div className={styles.mosaicContainer}>
					{mediaAttachments.length === 1 ? (
						<AttachmentSingleMedia
							attachment={mediaAttachments[0]}
							message={message}
							mediaAttachments={mediaAttachments}
							isPreview={isPreview}
							onDelete={onDelete}
						/>
					) : (
						<AttachmentLayoutGrid attachments={mediaAttachments} message={message} isPreview={isPreview} />
					)}
				</div>
				{renderFootnote()}
			</div>
		);
	},
);

export const AttachmentMosaic: FC<AttachmentMosaicProps> = AttachmentMosaicComponent;
