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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as MediaViewerActionCreators from '@app/actions/MediaViewerActionCreators';
import {AltTextBadge} from '@app/components/channel/embeds/AltTextBadge';
import {deriveDefaultNameFromMessage} from '@app/components/channel/embeds/EmbedUtils';
import styles from '@app/components/channel/embeds/media/EmbedVideo.module.css';
import {OverlayPlayButton} from '@app/components/channel/embeds/media/MediaButtons';
import {getMediaButtonVisibility} from '@app/components/channel/embeds/media/MediaButtonUtils';
import {MediaContainer} from '@app/components/channel/embeds/media/MediaContainer';
import type {BaseMediaProps} from '@app/components/channel/embeds/media/MediaTypes';
import {NSFWBlurOverlay} from '@app/components/channel/embeds/NSFWBlurOverlay';
import {useMaybeMessageViewContext} from '@app/components/channel/MessageViewContext';
import {VideoPlayer} from '@app/components/media_player/components/VideoPlayer';
import {MediaContextMenu} from '@app/components/uikit/context_menu/MediaContextMenu';
import {useDeleteAttachment} from '@app/hooks/useDeleteAttachment';
import {useMediaFavorite} from '@app/hooks/useMediaFavorite';
import {useNSFWMedia} from '@app/hooks/useNSFWMedia';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import VideoVolumeStore from '@app/stores/VideoVolumeStore';
import {createCalculator} from '@app/utils/DimensionUtils';
import {createSaveHandler} from '@app/utils/FileDownloadUtils';
import * as ImageCacheUtils from '@app/utils/ImageCacheUtils';
import {buildMediaProxyURL} from '@app/utils/MediaProxyUtils';
import {attachmentsToViewerItems, findViewerItemIndex} from '@app/utils/MediaViewerItemUtils';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {PlayIcon, SpeakerHighIcon, SpeakerXIcon} from '@phosphor-icons/react';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type {FC} from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {thumbHashToDataURL} from 'thumbhash';

const VIDEO_CONFIG = {
	MAX_WIDTH: 400,
} as const;

const videoCalculator = createCalculator({
	maxWidth: VIDEO_CONFIG.MAX_WIDTH,
	responsive: true,
});

type EmbedVideoProps = BaseMediaProps & {
	src: string;
	width: number;
	height: number;
	placeholder?: string;
	title?: string;
	alt?: string;
	duration?: number;
	embedUrl?: string;
	fillContainer?: boolean;
	mediaAttachments?: ReadonlyArray<MessageAttachment>;
	isPreview?: boolean;
};

const MobileVideoOverlay: FC<{
	thumbHashURL?: string;
	posterSrc: string | null;
	posterLoaded: boolean;
	onTap: () => void;
	onPlayInline: () => void;
	title?: string;
	alt?: string;
	onPopoutToggle?: (open: boolean) => void;
}> = observer(({thumbHashURL, posterSrc, posterLoaded, onTap, onPlayInline, title, alt, onPopoutToggle}) => {
	const {t} = useLingui();
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: presentation overlay handles tap to play
		<div className={styles.videoOverlay} onClick={onTap} role="presentation">
			<AnimatePresence>
				{thumbHashURL && !posterLoaded && (
					<motion.img
						key="placeholder"
						initial={{opacity: 1}}
						exit={{opacity: 0}}
						transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2}}
						src={thumbHashURL}
						alt={title ? t`Thumbnail for ${title}` : t`Video thumbnail`}
						className={styles.thumbnailPlaceholder}
					/>
				)}
			</AnimatePresence>

			{posterSrc && posterLoaded && (
				<img
					src={posterSrc}
					alt={title ? t`Thumbnail for ${title}` : t`Video thumbnail`}
					className={styles.thumbnailPlaceholder}
				/>
			)}

			<div
				className={styles.playButtonWrapper}
				onClick={(e) => {
					e.stopPropagation();
					onPlayInline();
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.stopPropagation();
						onPlayInline();
					}
				}}
				role="button"
				tabIndex={0}
			>
				<OverlayPlayButton
					onClick={onPlayInline}
					icon={<PlayIcon size={28} aria-hidden="true" />}
					ariaLabel={t`Play video`}
				/>
			</div>

			<AltTextBadge altText={alt} onPopoutToggle={onPopoutToggle} />
		</div>
	);
});

const EmbedVideo: FC<EmbedVideoProps> = observer(
	({
		src,
		width,
		height,
		placeholder,
		title,
		alt,
		duration,
		nsfw,
		channelId,
		messageId,
		attachmentId,
		embedIndex,
		embedUrl,
		message,
		contentHash,
		onDelete,
		fillContainer = false,
		mediaAttachments = [],
		isPreview,
	}) => {
		const {t} = useLingui();
		const {enabled: isMobile} = MobileLayoutStore;
		const messageViewContext = useMaybeMessageViewContext();
		const effectiveSrc = buildMediaProxyURL(src);
		const isBlob = src.startsWith('blob:');
		const posterSrc = isBlob ? null : buildMediaProxyURL(src, {format: 'webp'});
		const [posterLoaded, setPosterLoaded] = useState(posterSrc ? ImageCacheUtils.hasImage(posterSrc) : false);
		const [hasPlayed, setHasPlayed] = useState(false);
		const [isPlayingInline, setIsPlayingInline] = useState(false);
		const inlineVideoRef = useRef<HTMLVideoElement>(null);

		const {shouldBlur, gateReason} = useNSFWMedia(nsfw, channelId);

		const defaultName =
			title || deriveDefaultNameFromMessage({message, attachmentId, embedIndex, url: embedUrl || src, proxyUrl: src});

		const {
			isFavorited,
			toggleFavorite: handleFavoriteClick,
			canFavorite,
		} = useMediaFavorite({
			channelId,
			messageId,
			attachmentId,
			embedIndex,
			defaultName,
			contentHash,
		});

		const handleDownloadClick = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation();
				createSaveHandler(src, 'video')();
			},
			[src],
		);

		const handleDeleteClick = useDeleteAttachment(message, attachmentId);

		const handleContextMenu = useCallback(
			(e: React.MouseEvent) => {
				if (!message || isPreview) return;

				e.preventDefault();
				e.stopPropagation();

				ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
					<MediaContextMenu
						message={message}
						originalSrc={src}
						type="video"
						contentHash={contentHash}
						attachmentId={attachmentId}
						defaultName={defaultName}
						onClose={onClose}
						onDelete={onDelete || (() => {})}
					/>
				));
			},
			[message, src, contentHash, attachmentId, defaultName, onDelete, isPreview],
		);

		const thumbHashUrl = placeholder
			? thumbHashToDataURL(Uint8Array.from(atob(placeholder), (c) => c.charCodeAt(0)))
			: undefined;

		const {dimensions} = useCallback(() => {
			return videoCalculator.calculate({width, height}, {responsive: true});
		}, [width, height])();

		const aspectRatio = `${dimensions.width} / ${dimensions.height}`;

		useEffect(() => {
			if (!posterSrc) return;
			if (DeveloperOptionsStore.forceRenderPlaceholders || DeveloperOptionsStore.forceMediaLoading) {
				return;
			}

			ImageCacheUtils.loadImage(
				posterSrc,
				() => setPosterLoaded(true),
				() => setPosterLoaded(false),
			);
		}, [posterSrc]);

		const handleMobileTap = useCallback(() => {
			const videoItems = attachmentsToViewerItems(mediaAttachments, {filterType: 'video'});

			if (videoItems.length > 0) {
				const currentIndex = findViewerItemIndex(videoItems, attachmentId);
				MediaViewerActionCreators.openMediaViewer(videoItems, currentIndex, {
					channelId,
					messageId,
					message,
				});
			} else {
				MediaViewerActionCreators.openMediaViewer(
					[
						{
							src: effectiveSrc,
							originalSrc: embedUrl || src,
							naturalWidth: width,
							naturalHeight: height,
							type: 'video' as const,
							contentHash,
							embedIndex,
							duration,
						},
					],
					0,
					{channelId, messageId, message},
				);
			}
		}, [
			channelId,
			messageId,
			message,
			mediaAttachments,
			attachmentId,
			effectiveSrc,
			embedUrl,
			src,
			width,
			height,
			contentHash,
			embedIndex,
			duration,
		]);

		const handlePlayInline = useCallback(() => {
			setIsPlayingInline(true);
		}, []);

		const handleInlineVideoTap = useCallback(() => {
			const video = inlineVideoRef.current;
			const currentTime = video?.currentTime ?? 0;
			if (video) {
				video.pause();
			}

			const videoItems = attachmentsToViewerItems(mediaAttachments, {
				filterType: 'video',
				initialTimeForId: attachmentId ? {attachmentId, time: currentTime} : undefined,
			});

			if (videoItems.length > 0) {
				const currentIndex = findViewerItemIndex(videoItems, attachmentId);
				MediaViewerActionCreators.openMediaViewer(videoItems, currentIndex, {
					channelId,
					messageId,
					message,
				});
			} else {
				MediaViewerActionCreators.openMediaViewer(
					[
						{
							src: effectiveSrc,
							originalSrc: embedUrl || src,
							naturalWidth: width,
							naturalHeight: height,
							type: 'video' as const,
							contentHash,
							embedIndex,
							duration,
							initialTime: currentTime,
						},
					],
					0,
					{channelId, messageId, message},
				);
			}

			setIsPlayingInline(false);
		}, [
			channelId,
			messageId,
			message,
			mediaAttachments,
			attachmentId,
			effectiveSrc,
			embedUrl,
			src,
			width,
			height,
			contentHash,
			embedIndex,
			duration,
		]);

		const handleInlineVideoEnded = useCallback(() => {
			setIsPlayingInline(false);
		}, []);

		const handleToggleMute = useCallback((e: React.MouseEvent) => {
			e.stopPropagation();
			VideoVolumeStore.toggleMute();
		}, []);

		const containerStyles: React.CSSProperties = isMobile
			? {
					aspectRatio,
					width: `${dimensions.width}px`,
					maxWidth: '100%',
				}
			: fillContainer
				? {
						width: '100%',
						height: '100%',
					}
				: {
						width: `${dimensions.width}px`,
						maxWidth: '100%',
						aspectRatio,
					};

		if (shouldBlur) {
			return (
				<div className={styles.blurContainer}>
					<div className={styles.blurContent} style={containerStyles}>
						<div className={styles.blurInner}>
							{thumbHashUrl && (
								<img src={thumbHashUrl} alt="" className={styles.blurThumbnail} style={{filter: 'blur(40px)'}} />
							)}
						</div>
					</div>
					<NSFWBlurOverlay reason={gateReason} />
				</div>
			);
		}

		const handleInitialPlay = useCallback(() => {
			setHasPlayed(true);
		}, []);

		const {showFavoriteButton, showDownloadButton, showDeleteButton} = getMediaButtonVisibility(
			canFavorite,
			isPreview ? undefined : message,
			attachmentId,
			{disableDelete: !!isPreview},
		);

		if (isMobile) {
			return (
				<MediaContainer
					className={styles.mediaContainer}
					style={containerStyles}
					showFavoriteButton={showFavoriteButton}
					isFavorited={isFavorited}
					onFavoriteClick={handleFavoriteClick}
					showDownloadButton={showDownloadButton}
					onDownloadClick={handleDownloadClick}
					showDeleteButton={showDeleteButton}
					onDeleteClick={handleDeleteClick}
					onContextMenu={handleContextMenu}
					renderedWidth={dimensions.width}
					renderedHeight={dimensions.height}
				>
					<div className={styles.mobileContainer}>
						{isPlayingInline ? (
							<>
								<video
									ref={inlineVideoRef}
									className={styles.inlineVideo}
									src={effectiveSrc}
									autoPlay
									playsInline
									muted={VideoVolumeStore.isMuted}
									onClick={handleInlineVideoTap}
									onEnded={handleInlineVideoEnded}
								/>
								<button
									type="button"
									className={styles.inlineMuteButton}
									onClick={handleToggleMute}
									aria-label={VideoVolumeStore.isMuted ? t`Unmute` : t`Mute`}
								>
									{VideoVolumeStore.isMuted ? (
										<SpeakerXIcon size={16} weight="fill" />
									) : (
										<SpeakerHighIcon size={16} weight="fill" />
									)}
								</button>
							</>
						) : (
							<MobileVideoOverlay
								thumbHashURL={thumbHashUrl}
								posterSrc={posterSrc}
								posterLoaded={posterLoaded}
								onTap={handleMobileTap}
								onPlayInline={handlePlayInline}
								title={title}
								alt={alt}
								onPopoutToggle={messageViewContext?.onPopoutToggle}
							/>
						)}
					</div>
				</MediaContainer>
			);
		}

		return (
			<MediaContainer
				className={styles.mediaContainer}
				style={containerStyles}
				showFavoriteButton={showFavoriteButton}
				isFavorited={isFavorited}
				onFavoriteClick={handleFavoriteClick}
				showDownloadButton={showDownloadButton}
				onDownloadClick={handleDownloadClick}
				showDeleteButton={showDeleteButton}
				onDeleteClick={handleDeleteClick}
				onContextMenu={handleContextMenu}
				renderedWidth={dimensions.width}
				renderedHeight={dimensions.height}
			>
				<div className={styles.videoPlayerWrapper}>
					<VideoPlayer
						src={effectiveSrc}
						poster={posterSrc || undefined}
						placeholder={placeholder}
						duration={duration}
						width={dimensions.width}
						height={dimensions.height}
						fillContainer={fillContainer}
						className={fillContainer ? styles.videoPlayerFill : styles.videoPlayerBlock}
						onInitialPlay={handleInitialPlay}
					/>
					{!hasPlayed && <AltTextBadge altText={alt} onPopoutToggle={messageViewContext?.onPopoutToggle} />}
				</div>
			</MediaContainer>
		);
	},
);

export default EmbedVideo;
