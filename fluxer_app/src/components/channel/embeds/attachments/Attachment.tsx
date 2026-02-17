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

import styles from '@app/components/channel/embeds/attachments/Attachment.module.css';
import {AttachmentFile} from '@app/components/channel/embeds/attachments/AttachmentFile';
import EmbedAudio from '@app/components/channel/embeds/media/EmbedAudio';
import {EmbedGif, EmbedGifv} from '@app/components/channel/embeds/media/EmbedGifv';
import {EmbedImage} from '@app/components/channel/embeds/media/EmbedImage';
import EmbedVideo from '@app/components/channel/embeds/media/EmbedVideo';
import VoiceMessagePlayer from '@app/components/channel/embeds/media/VoiceMessagePlayer';
import {MessageUploadProgress} from '@app/components/channel/MessageUploadProgress';
import {ExpiryFootnote} from '@app/components/common/ExpiryFootnote';
import {SpoilerOverlay} from '@app/components/common/SpoilerOverlay';
import spoilerStyles from '@app/components/common/SpoilerOverlay.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import messageStyles from '@app/styles/Message.module.css';
import {getEffectiveAttachmentExpiry} from '@app/utils/AttachmentExpiryUtils';
import {createCalculator} from '@app/utils/DimensionUtils';
import {getAttachmentMediaDimensions} from '@app/utils/MediaDimensionConfig';
import {buildMediaProxyURL} from '@app/utils/MediaProxyUtils';
import {useSpoilerState} from '@app/utils/SpoilerUtils';
import {MessageAttachmentFlags, MessageFlags} from '@fluxer/constants/src/ChannelConstants';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type {FC} from 'react';

interface AttachmentProps {
	attachment: MessageAttachment;
	isPreview?: boolean;
	message?: MessageRecord;
	renderInMosaic?: boolean;
	mediaAttachments?: ReadonlyArray<MessageAttachment>;
	onDelete?: (bypassConfirm?: boolean) => void;
}

interface AttachmentMediaProps {
	attachment: MessageAttachment;
	mediaAttachments?: ReadonlyArray<MessageAttachment>;
	onDelete?: (bypassConfirm?: boolean) => void;
}

const isImageType = (contentType?: string): boolean => contentType?.startsWith('image/') ?? false;
const isVideoType = (contentType?: string): boolean => contentType?.startsWith('video/') ?? false;
const isAudioType = (contentType?: string): boolean => contentType?.startsWith('audio/') ?? false;
const isGifType = (contentType?: string): boolean => contentType === 'image/gif';

const isAnimated = (flags: number): boolean => (flags & MessageAttachmentFlags.IS_ANIMATED) !== 0;

const isUploading = (flags: number): boolean => (flags & 0x1000) !== 0;

const isVoiceMessageAttachment = (message: MessageRecord | undefined, attachment: MessageAttachment): boolean =>
	Boolean(message?.hasFlag(MessageFlags.VOICE_MESSAGE) && isAudioType(attachment.content_type) && attachment.waveform);

const hasValidDimensions = (attachment: MessageAttachment): boolean =>
	typeof attachment.width === 'number' && typeof attachment.height === 'number';

const AnimatedAttachment: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, isPreview, onDelete}) => {
		const embedUrl = attachment.url ?? '';
		const proxyUrl = attachment.proxy_url ?? embedUrl;
		const animatedProxyURL = buildMediaProxyURL(proxyUrl, {
			format: 'webp',
			animated: true,
		});
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;

		return (
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<EmbedGif
					embedURL={embedUrl}
					proxyURL={animatedProxyURL}
					naturalWidth={attachment.width!}
					naturalHeight={attachment.height!}
					placeholder={attachment.placeholder}
					alt={attachment.description ?? undefined}
					nsfw={nsfw}
					channelId={message?.channelId}
					messageId={message?.id}
					attachmentId={attachment.id}
					message={message}
					contentHash={attachment.content_hash}
					isPreview={isPreview}
					onDelete={onDelete}
				/>
			</FocusRing>
		);
	},
);

const VideoAttachment: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, mediaAttachments = [], isPreview, onDelete}) => {
		const embedUrl = attachment.url ?? '';
		const proxyUrl = attachment.proxy_url ?? embedUrl;
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;
		const attachmentDimensions = getAttachmentMediaDimensions(message);
		const mediaCalculator = createCalculator({
			maxWidth: attachmentDimensions.maxWidth,
			maxHeight: attachmentDimensions.maxHeight,
			responsive: true,
		});

		const {dimensions} = mediaCalculator.calculate(
			{
				width: attachment.width!,
				height: attachment.height!,
			},
			{forceScale: true},
		);

		return (
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<div className={styles.attachmentWrapper}>
					<EmbedVideo
						src={proxyUrl}
						width={dimensions.width}
						height={dimensions.height}
						placeholder={attachment.placeholder}
						title={attachment.title}
						alt={attachment.description ?? undefined}
						duration={attachment.duration}
						nsfw={nsfw}
						channelId={message?.channelId}
						messageId={message?.id}
						attachmentId={attachment.id}
						embedUrl={embedUrl}
						message={message}
						contentHash={attachment.content_hash}
						mediaAttachments={mediaAttachments}
						isPreview={isPreview}
						onDelete={onDelete}
					/>
				</div>
			</FocusRing>
		);
	},
);

const GifvAttachment: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, isPreview, onDelete}) => {
		const embedUrl = attachment.url ?? '';
		const proxyUrl = attachment.proxy_url ?? embedUrl;
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;
		return (
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<div className={styles.attachmentWrapper}>
					<EmbedGifv
						embedURL={embedUrl}
						videoProxyURL={proxyUrl}
						videoURL={embedUrl}
						naturalWidth={attachment.width!}
						naturalHeight={attachment.height!}
						placeholder={attachment.placeholder}
						alt={attachment.description ?? undefined}
						nsfw={nsfw}
						channelId={message?.channelId}
						messageId={message?.id}
						attachmentId={attachment.id}
						message={message}
						contentHash={attachment.content_hash}
						isPreview={isPreview}
						onDelete={onDelete}
					/>
				</div>
			</FocusRing>
		);
	},
);

const AudioAttachment: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, isPreview, onDelete}) => (
		<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
			<div className={styles.attachmentWrapper}>
				<EmbedAudio
					src={attachment.proxy_url ?? attachment.url ?? ''}
					title={attachment.title || attachment.filename}
					duration={attachment.duration}
					embedUrl={attachment.url ?? ''}
					channelId={message?.channelId}
					messageId={message?.id}
					attachmentId={attachment.id}
					message={message}
					contentHash={attachment.content_hash}
					isPreview={isPreview}
					onDelete={onDelete}
				/>
			</div>
		</FocusRing>
	),
);

const AttachmentMedia: FC<AttachmentMediaProps & {message?: MessageRecord; isPreview?: boolean}> = observer(
	({attachment, message, mediaAttachments = [], isPreview, onDelete}) => {
		const attachmentIsAnimated =
			isGifType(attachment.content_type) || (isAnimated(attachment.flags) && !isVideoType(attachment.content_type));
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;
		if (isVoiceMessageAttachment(message, attachment)) {
			const src = attachment.proxy_url ?? attachment.url ?? '';
			return (
				<VoiceMessagePlayer
					src={src}
					title={attachment.title ?? attachment.filename}
					duration={attachment.duration ?? undefined}
					waveform={attachment.waveform!}
					channelId={message?.channelId}
					messageId={message?.id}
					attachmentId={attachment.id}
					message={message}
					contentHash={attachment.content_hash ?? undefined}
					mediaAttachments={mediaAttachments}
					isPreview={isPreview}
					onDelete={onDelete}
				/>
			);
		}
		if (attachmentIsAnimated) {
			return <AnimatedAttachment attachment={attachment} message={message} isPreview={isPreview} onDelete={onDelete} />;
		}

		const attachmentDimensions = getAttachmentMediaDimensions(message);
		const mediaCalculator = createCalculator({
			maxWidth: attachmentDimensions.maxWidth,
			maxHeight: attachmentDimensions.maxHeight,
			responsive: true,
		});

		const {dimensions} = mediaCalculator.calculate(
			{
				width: attachment.width!,
				height: attachment.height!,
			},
			{forceScale: true},
		);

		const targetWidth = Math.round(dimensions.width * 2);
		const targetHeight = Math.round(dimensions.height * 2);
		const proxySrc = attachment.proxy_url ?? attachment.url ?? '';
		const optimizedSrc = buildMediaProxyURL(proxySrc, {
			format: 'webp',
			width: targetWidth,
			height: targetHeight,
			animated: attachmentIsAnimated,
		});

		return (
			<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
				<div className={styles.attachmentWrapper}>
					<EmbedImage
						src={optimizedSrc}
						originalSrc={attachment.url ?? ''}
						naturalWidth={attachment.width!}
						naturalHeight={attachment.height!}
						width={dimensions.width}
						height={dimensions.height}
						placeholder={attachment.placeholder}
						constrain={true}
						alt={attachment.title || attachment.description}
						nsfw={nsfw}
						channelId={message?.channelId}
						messageId={message?.id}
						attachmentId={attachment.id}
						message={message}
						contentHash={attachment.content_hash}
						mediaAttachments={mediaAttachments}
						isPreview={isPreview}
						animated={attachmentIsAnimated}
						onDelete={onDelete}
					/>
				</div>
			</FocusRing>
		);
	},
);

export const Attachment: FC<AttachmentProps> = observer(
	({attachment, isPreview, message, renderInMosaic, onDelete}) => {
		const {t} = useLingui();
		const isSpoiler = (attachment.flags & MessageAttachmentFlags.IS_SPOILER) !== 0;
		const {hidden: spoilerHidden, reveal: revealSpoiler} = useSpoilerState(isSpoiler, message?.channelId);

		const wrapSpoiler = (node: React.ReactElement, className?: string) =>
			isSpoiler ? (
				<SpoilerOverlay hidden={spoilerHidden} onReveal={revealSpoiler} className={className}>
					{node}
				</SpoilerOverlay>
			) : (
				node
			);

		if (isUploading(attachment.flags) && message) {
			return wrapSpoiler(<MessageUploadProgress attachment={attachment} message={message} />);
		}

		const {
			attachment: att,
			isExpired: effectiveExpired,
			expiresAt: effectiveExpiresAt,
		} = getEffectiveAttachmentExpiry(attachment, DeveloperOptionsStore.mockAttachmentStates[attachment.id]);
		const enrichedAttachment = {
			...att,
			url: att.url ?? null,
			proxy_url: att.proxy_url ?? att.url ?? null,
		};
		const renderWithFootnote = (content: React.ReactElement) => (
			<div className={styles.attachmentWrapper}>
				{content}
				{AccessibilityStore.showAttachmentExpiryIndicator && (
					<ExpiryFootnote expiresAt={effectiveExpiresAt} isExpired={effectiveExpired} />
				)}
			</div>
		);

		if (effectiveExpired || !att.url) {
			return renderWithFootnote(
				wrapSpoiler(<AttachmentFile attachment={enrichedAttachment} isPreview={isPreview} message={message} />),
			);
		}

		const inlineAttachmentMedia = UserSettingsStore.getInlineAttachmentMedia();

		if (
			renderInMosaic &&
			hasValidDimensions(att) &&
			(isImageType(att.content_type) || isVideoType(att.content_type) || isAudioType(att.content_type))
		) {
			return null;
		}

		if (!inlineAttachmentMedia && (isImageType(att.content_type) || isVideoType(att.content_type))) {
			return renderWithFootnote(
				wrapSpoiler(
					<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
						<AttachmentFile attachment={enrichedAttachment} isPreview={isPreview} message={message} />
					</FocusRing>,
				),
			);
		}

		if (isAudioType(att.content_type)) {
			return renderWithFootnote(
				wrapSpoiler(
					<div className={effectiveExpired ? styles.expiredContent : undefined}>
						{effectiveExpired && <div className={styles.expiredOverlay}>{t`This attachment has expired`}</div>}
						{isVoiceMessageAttachment(message, enrichedAttachment) ? (
							<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
								<VoiceMessagePlayer
									src={enrichedAttachment.proxy_url ?? enrichedAttachment.url ?? ''}
									title={enrichedAttachment.title ?? enrichedAttachment.filename}
									duration={enrichedAttachment.duration ?? undefined}
									waveform={enrichedAttachment.waveform!}
									channelId={message?.channelId}
									messageId={message?.id}
									attachmentId={enrichedAttachment.id}
									message={message}
									contentHash={enrichedAttachment.content_hash ?? undefined}
									isPreview={isPreview}
									onDelete={onDelete}
								/>
							</FocusRing>
						) : (
							<AudioAttachment
								attachment={enrichedAttachment}
								message={message}
								isPreview={isPreview}
								onDelete={onDelete}
							/>
						)}
					</div>,
				),
			);
		}

		if (!hasValidDimensions(att)) {
			return renderWithFootnote(
				wrapSpoiler(
					<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
						<AttachmentFile attachment={enrichedAttachment} isPreview={isPreview} message={message} />
					</FocusRing>,
				),
			);
		}

		if (isImageType(att.content_type)) {
			return renderWithFootnote(
				wrapSpoiler(
					<div className={effectiveExpired ? styles.expiredContent : undefined}>
						{effectiveExpired && <div className={styles.expiredOverlay}>{t`This attachment has expired`}</div>}
						<AttachmentMedia
							attachment={enrichedAttachment}
							message={message}
							isPreview={isPreview}
							onDelete={onDelete}
						/>
					</div>,
					spoilerStyles.media,
				),
			);
		}

		if (isVideoType(att.content_type)) {
			return renderWithFootnote(
				wrapSpoiler(
					<div className={effectiveExpired ? styles.expiredContent : undefined}>
						{effectiveExpired && <div className={styles.expiredOverlay}>{t`This attachment has expired`}</div>}
						{isAnimated(att.flags) ? (
							<GifvAttachment
								attachment={enrichedAttachment}
								message={message}
								isPreview={isPreview}
								onDelete={onDelete}
							/>
						) : (
							<VideoAttachment
								attachment={enrichedAttachment}
								message={message}
								isPreview={isPreview}
								onDelete={onDelete}
							/>
						)}
					</div>,
					spoilerStyles.media,
				),
			);
		}

		return renderWithFootnote(
			wrapSpoiler(
				<div className={effectiveExpired ? styles.expiredContent : undefined}>
					{effectiveExpired && <div className={styles.expiredOverlay}>{t`This attachment has expired`}</div>}
					<FocusRing within ringClassName={messageStyles.mediaFocusRing}>
						<AttachmentFile attachment={att} isPreview={isPreview} message={message} />
					</FocusRing>
				</div>,
			),
		);
	},
);
