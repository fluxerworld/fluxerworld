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

import {EmbedGif, EmbedGifv} from '@app/components/channel/embeds/media/EmbedGifv';
import {EmbedImage} from '@app/components/channel/embeds/media/EmbedImage';
import EmbedVideo from '@app/components/channel/embeds/media/EmbedVideo';
import {SpoilerOverlay} from '@app/components/common/SpoilerOverlay';
import spoilerStyles from '@app/components/common/SpoilerOverlay.module.css';
import type {MessageRecord} from '@app/records/MessageRecord';
import styles from '@app/styles/AttachmentSingleMedia.module.css';
import {createCalculator} from '@app/utils/DimensionUtils';
import {getAttachmentMediaDimensions} from '@app/utils/MediaDimensionConfig';
import {buildMediaProxyURL} from '@app/utils/MediaProxyUtils';
import {determineMediaType} from '@app/utils/MediaViewerItemUtils';
import {useSpoilerState} from '@app/utils/SpoilerUtils';
import {MessageAttachmentFlags} from '@fluxer/constants/src/ChannelConstants';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {observer} from 'mobx-react-lite';
import type {CSSProperties, FC, ReactElement} from 'react';

export interface AttachmentSingleMediaProps {
	attachment: MessageAttachment;
	message?: MessageRecord;
	mediaAttachments: ReadonlyArray<MessageAttachment>;
	isPreview?: boolean;
	onDelete?: (bypassConfirm?: boolean) => void;
}

interface AttachmentMediaConstraintStyle extends CSSProperties {
	'--attachment-media-max-height': string;
	'--attachment-media-max-width': string;
}

export const AttachmentSingleMedia: FC<AttachmentSingleMediaProps> = observer(
	({attachment, message, mediaAttachments, isPreview, onDelete}) => {
		const mediaType = determineMediaType(attachment);
		const isGifv = mediaType === 'gifv';
		const isVideo = mediaType === 'video';
		const isAnimatedGif = mediaType === 'gif';
		const isSpoiler = (attachment.flags & MessageAttachmentFlags.IS_SPOILER) !== 0;
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;

		const {hidden: spoilerHidden, reveal: revealSpoiler} = useSpoilerState(isSpoiler, message?.channelId);

		const wrapSpoiler = (node: ReactElement) =>
			isSpoiler ? (
				<SpoilerOverlay hidden={spoilerHidden} onReveal={revealSpoiler} className={spoilerStyles.media}>
					{node}
				</SpoilerOverlay>
			) : (
				node
			);

		const naturalWidth = attachment.width!;
		const naturalHeight = attachment.height!;

		const attachmentDimensions = getAttachmentMediaDimensions(message);
		const standaloneMediaCalculator = createCalculator({
			maxWidth: attachmentDimensions.maxWidth,
			maxHeight: attachmentDimensions.maxHeight,
			responsive: true,
		});
		const mediaConstraintStyle: AttachmentMediaConstraintStyle = {
			'--attachment-media-max-height': `${attachmentDimensions.maxHeight}px`,
			'--attachment-media-max-width': `${attachmentDimensions.maxWidth}px`,
		};

		const {dimensions} = standaloneMediaCalculator.calculate(
			{
				width: naturalWidth,
				height: naturalHeight,
			},
			{forceScale: true},
		);

		const safeProxy = attachment.proxy_url ?? attachment.url ?? '';
		const safeUrl = attachment.url ?? '';

		const commonProps = {
			channelId: message?.channelId,
			messageId: message?.id,
			attachmentId: attachment.id,
			message,
			contentHash: attachment.content_hash,
			placeholder: attachment.placeholder,
			nsfw,
			onDelete,
		};

		if (isGifv) {
			return wrapSpoiler(
				<div className={styles.relativeWrapper} style={mediaConstraintStyle}>
					<div className={styles.singleMediaContainer}>
						<EmbedGifv
							{...commonProps}
							embedURL={safeUrl}
							videoProxyURL={safeProxy}
							videoURL={safeUrl}
							naturalWidth={naturalWidth}
							naturalHeight={naturalHeight}
							isPreview={isPreview}
							alt={attachment.description ?? undefined}
						/>
					</div>
				</div>,
			);
		}

		if (isVideo) {
			return wrapSpoiler(
				<div className={styles.relativeWrapper} style={mediaConstraintStyle}>
					<div className={styles.singleMediaContainer}>
						<EmbedVideo
							{...commonProps}
							src={safeProxy}
							width={dimensions.width}
							height={dimensions.height}
							title={attachment.title || attachment.filename}
							alt={attachment.description ?? undefined}
							mediaAttachments={mediaAttachments}
							isPreview={isPreview}
						/>
					</div>
				</div>,
			);
		}

		if (isAnimatedGif) {
			const animatedProxyURL = buildMediaProxyURL(attachment.proxy_url ?? attachment.url ?? '', {
				format: 'webp',
				animated: true,
			});

			return wrapSpoiler(
				<div className={styles.relativeWrapper} style={mediaConstraintStyle}>
					<div className={styles.singleMediaContainer}>
						<EmbedGif
							{...commonProps}
							embedURL={safeUrl}
							proxyURL={animatedProxyURL}
							naturalWidth={naturalWidth}
							naturalHeight={naturalHeight}
							isPreview={isPreview}
							alt={attachment.description ?? undefined}
						/>
					</div>
				</div>,
			);
		}

		const targetWidth = Math.round(dimensions.width * 2);
		const targetHeight = Math.round(dimensions.height * 2);

		const optimizedSrc = buildMediaProxyURL(attachment.proxy_url ?? attachment.url ?? '', {
			format: 'webp',
			width: targetWidth,
			height: targetHeight,
		});

		return wrapSpoiler(
			<div className={styles.relativeWrapper} style={mediaConstraintStyle}>
				<div className={styles.singleMediaContainer}>
					<EmbedImage
						{...commonProps}
						src={optimizedSrc}
						originalSrc={safeUrl}
						naturalWidth={naturalWidth}
						naturalHeight={naturalHeight}
						width={dimensions.width}
						height={dimensions.height}
						constrain={true}
						mediaAttachments={mediaAttachments}
						isPreview={isPreview}
						animated={isAnimatedGif}
						alt={attachment.description ?? undefined}
					/>
				</div>
			</div>,
		);
	},
);
