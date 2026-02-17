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
import embedStyles from '@app/components/channel/embeds/Embed.module.css';
import {deriveDefaultNameFromMessage} from '@app/components/channel/embeds/EmbedUtils';
import styles from '@app/components/channel/embeds/media/EmbedGifv.module.css';
import {GifIndicator} from '@app/components/channel/embeds/media/GifIndicator';
import {getMediaButtonVisibility} from '@app/components/channel/embeds/media/MediaButtonUtils';
import {MediaContainer, shouldShowOverlays} from '@app/components/channel/embeds/media/MediaContainer';
import type {BaseMediaProps} from '@app/components/channel/embeds/media/MediaTypes';
import {NSFWBlurOverlay} from '@app/components/channel/embeds/NSFWBlurOverlay';
import {useMaybeMessageViewContext} from '@app/components/channel/MessageViewContext';
import {MediaContextMenu} from '@app/components/uikit/context_menu/MediaContextMenu';
import {useDeleteAttachment} from '@app/hooks/useDeleteAttachment';
import {useMediaFavorite} from '@app/hooks/useMediaFavorite';
import {useMediaLoading} from '@app/hooks/useMediaLoading';
import {useNSFWMedia} from '@app/hooks/useNSFWMedia';
import KlipyWatermarkSvg from '@app/images/klipy-watermark.svg?react';
import FocusManager from '@app/lib/FocusManager';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import MediaViewerStore from '@app/stores/MediaViewerStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {createCalculator} from '@app/utils/DimensionUtils';
import {createSaveHandler} from '@app/utils/FileDownloadUtils';
import {getEmbedMediaDimensions} from '@app/utils/MediaDimensionConfig';
import {buildMediaProxyURL, stripMediaProxyParams} from '@app/utils/MediaProxyUtils';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {type FC, useCallback, useEffect, useMemo, useRef} from 'react';

type GifvEmbedProps = BaseMediaProps & {
	embedURL: string;
	naturalWidth: number;
	naturalHeight: number;
	placeholder?: string;
	alt?: string | null;
};

interface VideoConfig {
	autoplay?: boolean;
	loop?: boolean;
	muted?: boolean;
	playsInline?: boolean;
	controls?: boolean;
	preload?: 'none' | 'metadata' | 'auto';
}

function useEmbedMediaCalculator() {
	const embedDimensions = getEmbedMediaDimensions();
	return useMemo(
		() =>
			createCalculator({
				maxWidth: embedDimensions.maxWidth,
				maxHeight: embedDimensions.maxHeight,
				responsive: true,
			}),
		[embedDimensions.maxHeight, embedDimensions.maxWidth],
	);
}

const useImagePreview = ({
	proxyUrl,
	embedUrl,
	naturalWidth,
	naturalHeight,
	type,
	channelId,
	messageId,
	attachmentId,
	embedIndex,
	contentHash,
	message,
	providerName,
}: {
	proxyUrl: string;
	embedUrl: string;
	naturalWidth: number;
	naturalHeight: number;
	type: 'gifv' | 'gif' | 'image';
	channelId?: string;
	messageId?: string;
	attachmentId?: string;
	embedIndex?: number;
	contentHash?: string | null;
	message?: MessageRecord;
	providerName?: string;
}) => {
	return useCallback(
		(event: React.MouseEvent | React.KeyboardEvent) => {
			if (event.type === 'click' && (event as React.MouseEvent).button !== 0) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();

			MediaViewerActionCreators.openMediaViewer(
				[
					{
						src: proxyUrl,
						originalSrc: embedUrl,
						naturalWidth,
						naturalHeight,
						type,
						contentHash,
						attachmentId,
						embedIndex,
						animated: true,
						providerName,
					},
				],
				0,
				{
					channelId,
					messageId,
					message,
				},
			);
		},
		[
			proxyUrl,
			embedUrl,
			naturalWidth,
			naturalHeight,
			type,
			channelId,
			messageId,
			attachmentId,
			embedIndex,
			contentHash,
			message,
			providerName,
		],
	);
};

interface ImagePreviewHandlerProps {
	src: string;
	originalSrc: string;
	naturalWidth: number;
	naturalHeight: number;
	type: 'gifv' | 'gif' | 'image';
	handlePress?: (event: React.MouseEvent | React.KeyboardEvent) => void;
	channelId?: string;
	messageId?: string;
	attachmentId?: string;
	embedIndex?: number;
	contentHash?: string | null;
	message?: MessageRecord;
	children: React.ReactNode;
}

const ImagePreviewHandler: FC<ImagePreviewHandlerProps> = observer(
	({
		src,
		originalSrc,
		naturalWidth,
		naturalHeight,
		type,
		handlePress,
		channelId,
		messageId,
		attachmentId,
		embedIndex,
		contentHash,
		message,
		children,
	}) => {
		const {t} = useLingui();
		const openImagePreview = useCallback(
			(event: React.MouseEvent | React.KeyboardEvent) => {
				if (event.type === 'click' && (event as React.MouseEvent).button !== 0) {
					return;
				}

				if (event.type === 'keydown') {
					const keyEvent = event as React.KeyboardEvent;
					if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') {
						return;
					}
				}

				if (handlePress) {
					event.preventDefault();
					event.stopPropagation();
					handlePress(event);
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				MediaViewerActionCreators.openMediaViewer(
					[
						{
							src,
							originalSrc,
							naturalWidth,
							naturalHeight,
							type,
							contentHash,
							attachmentId,
							embedIndex,
							animated: true,
						},
					],
					0,
					{
						channelId,
						messageId,
						message,
					},
				);
			},
			[
				src,
				originalSrc,
				naturalWidth,
				naturalHeight,
				handlePress,
				type,
				channelId,
				messageId,
				attachmentId,
				embedIndex,
				contentHash,
				message,
			],
		);

		const ariaLabel = (() => {
			if (type === 'gifv') return t`Open animated GIF video in full view`;
			if (type === 'gif') return t`Open animated GIF in full view`;
			return t`Open image in full view`;
		})();

		return (
			<button
				type="button"
				className={styles.imagePreviewHandler}
				aria-label={ariaLabel}
				onClick={openImagePreview}
				onKeyDown={openImagePreview}
			>
				{children}
			</button>
		);
	},
);

export const EmbedGifv: FC<
	GifvEmbedProps & {
		videoProxyURL: string;
		videoURL: string;
		videoConfig?: VideoConfig;
		isPreview?: boolean;
		providerName?: string;
	}
> = observer(
	({
		embedURL,
		videoProxyURL,
		alt,
		naturalWidth,
		naturalHeight,
		placeholder,
		videoConfig,
		nsfw,
		channelId,
		messageId,
		attachmentId,
		embedIndex,
		message,
		contentHash,
		onDelete,
		isPreview,
		providerName,
	}) => {
		const {t} = useLingui();
		const messageViewContext = useMaybeMessageViewContext();
		const mediaCalculator = useEmbedMediaCalculator();
		const {loaded, error, thumbHashURL} = useMediaLoading(
			buildMediaProxyURL(videoProxyURL, {format: 'webp'}),
			placeholder,
		);
		const videoRef = useRef<HTMLVideoElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);
		const {shouldBlur, gateReason} = useNSFWMedia(nsfw, channelId);

		const defaultName = deriveDefaultNameFromMessage({
			message,
			attachmentId,
			embedIndex,
			url: embedURL,
			proxyUrl: videoProxyURL,
		});
		const effectiveDefaultName = alt?.trim() ? alt.trim() : defaultName || 'GIF';

		const {toggleFavorite, isFavorited, canFavorite} = useMediaFavorite({
			channelId,
			messageId,
			attachmentId,
			embedIndex,
			defaultName: effectiveDefaultName,
			contentHash,
			isGifv: true,
		});

		const {gifAutoPlay} = UserSettingsStore;
		const isMediaViewerOpen = MediaViewerStore.isOpen;

		const openImagePreview = useImagePreview({
			proxyUrl: videoProxyURL,
			embedUrl: embedURL,
			naturalWidth,
			naturalHeight,
			type: 'gifv',
			channelId,
			messageId,
			attachmentId,
			embedIndex,
			contentHash,
			message,
			providerName,
		});

		const handleDeleteClick = useDeleteAttachment(message, attachmentId);

		const handleDownloadClick = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation();
				createSaveHandler(videoProxyURL, 'video')();
			},
			[videoProxyURL],
		);

		const handleContextMenu = useCallback(
			(e: React.MouseEvent) => {
				if (!message || isPreview) return;

				e.preventDefault();
				e.stopPropagation();

				ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
					<MediaContextMenu
						message={message}
						originalSrc={embedURL}
						proxyURL={videoProxyURL}
						type="gifv"
						contentHash={contentHash}
						attachmentId={attachmentId}
						defaultName={effectiveDefaultName}
						defaultAltText={alt ?? undefined}
						onClose={onClose}
						onDelete={onDelete || (() => {})}
					/>
				));
			},
			[message, embedURL, videoProxyURL, contentHash, attachmentId, effectiveDefaultName, alt, onDelete, isPreview],
		);

		useEffect(() => {
			const video = videoRef.current;
			if (!video) return;

			video.loop = videoConfig?.loop ?? true;
			video.muted = videoConfig?.muted ?? true;
			video.playsInline = videoConfig?.playsInline ?? true;
			video.preload = videoConfig?.preload ?? 'auto';

			if (isMediaViewerOpen) {
				video.autoplay = false;
				video.pause();
				return;
			}

			if (gifAutoPlay && FocusManager.isFocused()) {
				video.autoplay = true;
				video.play().catch(() => {});
			} else {
				video.autoplay = false;
			}
		}, [videoConfig, gifAutoPlay, isMediaViewerOpen]);

		useEffect(() => {
			if (gifAutoPlay || isMediaViewerOpen) return;

			const video = videoRef.current;
			const container = containerRef.current;
			if (!video || !container) return;

			const handleMouseEnter = () => {
				if (FocusManager.isFocused()) {
					video.play().catch(() => {});
				}
			};
			const handleMouseLeave = () => {
				video.pause();
			};

			container.addEventListener('mouseenter', handleMouseEnter);
			container.addEventListener('mouseleave', handleMouseLeave);

			return () => {
				container.removeEventListener('mouseenter', handleMouseEnter);
				container.removeEventListener('mouseleave', handleMouseLeave);
			};
		}, [gifAutoPlay, isMediaViewerOpen]);

		useEffect(() => {
			const video = videoRef.current;
			if (!video) return;

			if (isMediaViewerOpen) {
				video.pause();
				return;
			}

			const unsubscribe = FocusManager.subscribe((focused) => {
				if (isMediaViewerOpen) {
					return;
				}
				if (!focused) {
					video.pause();
				} else if (gifAutoPlay) {
					video.play().catch(() => {});
				}
			});

			return unsubscribe;
		}, [gifAutoPlay, isMediaViewerOpen]);

		if (shouldBlur) {
			const {style} = mediaCalculator.calculate({width: naturalWidth, height: naturalHeight}, {forceScale: true});
			const {width: _width, height: _height, ...styleWithoutDimensions} = style;
			const blurContainerStyle = {...styleWithoutDimensions, maxWidth: '100%', width: '100%'};
			return (
				<div className={styles.blurContainer}>
					<div className={styles.blurContent} style={blurContainerStyle}>
						<div className={styles.blurInnerContainer}>
							{thumbHashURL && (
								<img src={thumbHashURL} className={styles.thumbHashPlaceholder} alt="" style={{filter: 'blur(40px)'}} />
							)}
						</div>
					</div>
					<NSFWBlurOverlay reason={gateReason} />
				</div>
			);
		}

		const {style, dimensions} = mediaCalculator.calculate(
			{width: naturalWidth, height: naturalHeight},
			{forceScale: true},
		);
		const {
			showFavoriteButton,
			showDownloadButton: _showDownloadButton,
			showDeleteButton,
		} = getMediaButtonVisibility(canFavorite, isPreview ? undefined : message, attachmentId, {
			disableDelete: !!isPreview,
		});
		const showDownloadButton = false;
		const showGifIndicator =
			AccessibilityStore.showGifIndicator && shouldShowOverlays(dimensions.width, dimensions.height);

		const {width} = style;
		const aspectRatio =
			dimensions.width > 0 && dimensions.height > 0 ? `${dimensions.width} / ${dimensions.height}` : '';
		const containerStyle = {
			'--embed-aspect-ratio': aspectRatio || 'auto',
			'--embed-height': `${dimensions.height}px`,
			'--embed-width': typeof width === 'number' ? `${width}px` : `${dimensions.width}px`,
			maxWidth: '100%',
			width: `${dimensions.width}px`,
			...(aspectRatio ? {aspectRatio} : {}),
		} as React.CSSProperties;

		return (
			<MediaContainer
				ref={containerRef}
				className={clsx(embedStyles.embedGifvContainer, styles.mediaContainer)}
				style={containerStyle}
				showFavoriteButton={showFavoriteButton}
				isFavorited={isFavorited}
				onFavoriteClick={toggleFavorite}
				showDownloadButton={showDownloadButton}
				onDownloadClick={handleDownloadClick}
				showDeleteButton={showDeleteButton}
				onDeleteClick={handleDeleteClick}
				onContextMenu={handleContextMenu}
				renderedWidth={dimensions.width}
				renderedHeight={dimensions.height}
				forceShowFavoriteButton={true}
			>
				{showGifIndicator && <GifIndicator />}
				{providerName === 'KLIPY' && (
					<div className={styles.klipyWatermark}>
						<KlipyWatermarkSvg />
					</div>
				)}
				<ImagePreviewHandler
					src={videoProxyURL}
					originalSrc={embedURL}
					naturalWidth={naturalWidth}
					naturalHeight={naturalHeight}
					type="gifv"
					handlePress={openImagePreview}
				>
					<div className={styles.videoWrapper}>
						{(!loaded || error) && thumbHashURL && (
							<img src={thumbHashURL} className={styles.thumbHashPlaceholder} alt={t`Loading placeholder`} />
						)}
						<video
							className={clsx(
								styles.videoElement,
								!loaded && !error ? styles.videoOpacityHidden : styles.videoOpacityVisible,
							)}
							controls={videoConfig?.controls ?? false}
							playsInline={videoConfig?.playsInline ?? true}
							loop={videoConfig?.loop ?? true}
							muted={videoConfig?.muted ?? true}
							poster={buildMediaProxyURL(videoProxyURL, {format: 'webp'})}
							preload={videoConfig?.preload ?? 'auto'}
							src={videoProxyURL}
							ref={videoRef}
							aria-label={t`Animated GIF video`}
							data-embed-media="gifv"
							tabIndex={-1}
							width={dimensions.width}
							height={dimensions.height}
						/>
					</div>
				</ImagePreviewHandler>
				<AltTextBadge altText={alt} onPopoutToggle={messageViewContext?.onPopoutToggle} />
			</MediaContainer>
		);
	},
);

export const EmbedGif: FC<GifvEmbedProps & {proxyURL: string; includeButton?: boolean; isPreview?: boolean}> = observer(
	({
		embedURL,
		proxyURL,
		alt,
		naturalWidth,
		naturalHeight,
		placeholder,
		nsfw,
		channelId,
		messageId,
		attachmentId,
		embedIndex,
		message,
		contentHash,
		onDelete,
		isPreview,
	}) => {
		const {t} = useLingui();
		const messageViewContext = useMaybeMessageViewContext();
		const mediaCalculator = useEmbedMediaCalculator();
		const {dimensions} = mediaCalculator.calculate({width: naturalWidth, height: naturalHeight}, {forceScale: true});
		const {width: displayWidth, height: displayHeight} = dimensions;

		const baseProxyURL = stripMediaProxyParams(proxyURL);

		const optimizedAnimatedURL = buildMediaProxyURL(baseProxyURL, {
			format: 'webp',
			width: Math.round(displayWidth * 2),
			height: Math.round(displayHeight * 2),
			animated: true,
		});

		const optimizedStaticURL = buildMediaProxyURL(baseProxyURL, {
			format: 'webp',
			width: Math.round(displayWidth * 2),
			height: Math.round(displayHeight * 2),
			animated: false,
		});

		const {loaded, error, thumbHashURL} = useMediaLoading(optimizedAnimatedURL, placeholder);
		const {shouldBlur, gateReason} = useNSFWMedia(nsfw, channelId);
		const containerRef = useRef<HTMLDivElement>(null);
		const imgRef = useRef<HTMLImageElement>(null);
		const isHoveredRef = useRef(false);

		const defaultName = deriveDefaultNameFromMessage({
			message,
			attachmentId,
			embedIndex,
			url: embedURL,
			proxyUrl: proxyURL,
		});
		const effectiveDefaultName = alt?.trim() ? alt.trim() : defaultName || 'GIF';

		const {toggleFavorite, isFavorited, canFavorite} = useMediaFavorite({
			channelId,
			messageId,
			attachmentId,
			embedIndex,
			defaultName: effectiveDefaultName,
			contentHash,
		});

		const {gifAutoPlay} = UserSettingsStore;

		const openImagePreview = useImagePreview({
			proxyUrl: optimizedAnimatedURL,
			embedUrl: embedURL,
			naturalWidth,
			naturalHeight,
			type: 'gif',
			channelId,
			messageId,
			attachmentId,
			embedIndex,
			contentHash,
			message,
		});

		const handleDeleteClick = useDeleteAttachment(message, attachmentId);

		const handleDownloadClickGif = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation();
				createSaveHandler(proxyURL, 'image')();
			},
			[proxyURL],
		);

		const handleContextMenu = useCallback(
			(e: React.MouseEvent) => {
				if (!message || isPreview) return;

				e.preventDefault();
				e.stopPropagation();

				ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
					<MediaContextMenu
						message={message}
						originalSrc={embedURL}
						proxyURL={proxyURL}
						type="gif"
						contentHash={contentHash}
						attachmentId={attachmentId}
						defaultName={effectiveDefaultName}
						defaultAltText={alt ?? undefined}
						onClose={onClose}
						onDelete={onDelete || (() => {})}
					/>
				));
			},
			[message, embedURL, proxyURL, contentHash, attachmentId, effectiveDefaultName, alt, onDelete, isPreview],
		);

		useEffect(() => {
			if (gifAutoPlay) return;

			const container = containerRef.current;
			if (!container) return;

			const handleMouseEnter = () => {
				isHoveredRef.current = true;
				if (FocusManager.isFocused()) {
					const img = imgRef.current;
					if (img) {
						img.src = optimizedAnimatedURL;
					}
				}
			};
			const handleMouseLeave = () => {
				isHoveredRef.current = false;
				const img = imgRef.current;
				if (img) {
					img.src = optimizedStaticURL;
				}
			};

			container.addEventListener('mouseenter', handleMouseEnter);
			container.addEventListener('mouseleave', handleMouseLeave);

			return () => {
				container.removeEventListener('mouseenter', handleMouseEnter);
				container.removeEventListener('mouseleave', handleMouseLeave);
			};
		}, [gifAutoPlay, optimizedAnimatedURL, optimizedStaticURL]);

		useEffect(() => {
			if (gifAutoPlay) return;

			const unsubscribe = FocusManager.subscribe((focused) => {
				const img = imgRef.current;
				if (!img) return;
				if (!focused) {
					img.src = optimizedStaticURL;
					return;
				}
				if (isHoveredRef.current && focused) {
					img.src = optimizedAnimatedURL;
				}
			});

			return unsubscribe;
		}, [gifAutoPlay, optimizedAnimatedURL, optimizedStaticURL]);

		if (shouldBlur) {
			const {style} = mediaCalculator.calculate({width: naturalWidth, height: naturalHeight}, {forceScale: true});
			const {width: _width, height: _height, ...styleWithoutDimensions} = style;
			const blurContainerStyle = {...styleWithoutDimensions, maxWidth: '100%', width: '100%'};
			return (
				<div className={styles.blurContainer}>
					<div className={styles.blurContent} style={blurContainerStyle}>
						<div className={styles.blurInnerContainer}>
							{thumbHashURL && (
								<img src={thumbHashURL} className={styles.thumbHashPlaceholder} alt="" style={{filter: 'blur(40px)'}} />
							)}
						</div>
					</div>
					<NSFWBlurOverlay reason={gateReason} />
				</div>
			);
		}

		const {style, dimensions: renderedDimensions} = mediaCalculator.calculate(
			{width: naturalWidth, height: naturalHeight},
			{forceScale: true},
		);
		const {showFavoriteButton, showDownloadButton, showDeleteButton} = getMediaButtonVisibility(
			canFavorite,
			isPreview ? undefined : message,
			attachmentId,
			{disableDelete: !!isPreview},
		);
		const showGifIndicator =
			AccessibilityStore.showGifIndicator && shouldShowOverlays(renderedDimensions.width, renderedDimensions.height);

		const {width} = style;
		const aspectRatio =
			renderedDimensions.width > 0 && renderedDimensions.height > 0
				? `${renderedDimensions.width} / ${renderedDimensions.height}`
				: '';
		const containerStyle = {
			'--embed-aspect-ratio': aspectRatio || 'auto',
			'--embed-height': `${renderedDimensions.height}px`,
			'--embed-width': typeof width === 'number' ? `${width}px` : `${renderedDimensions.width}px`,
			maxWidth: '100%',
			width: `${renderedDimensions.width}px`,
			...(aspectRatio ? {aspectRatio} : {}),
		} as React.CSSProperties;

		return (
			<MediaContainer
				ref={containerRef}
				className={clsx(embedStyles.embedGifvContainer, styles.mediaContainer)}
				style={containerStyle}
				showFavoriteButton={showFavoriteButton}
				isFavorited={isFavorited}
				onFavoriteClick={toggleFavorite}
				showDownloadButton={showDownloadButton}
				onDownloadClick={handleDownloadClickGif}
				showDeleteButton={showDeleteButton}
				onDeleteClick={handleDeleteClick}
				onContextMenu={handleContextMenu}
				renderedWidth={renderedDimensions.width}
				renderedHeight={renderedDimensions.height}
				forceShowFavoriteButton={true}
			>
				{showGifIndicator && <GifIndicator />}
				<ImagePreviewHandler
					src={optimizedAnimatedURL}
					originalSrc={embedURL}
					naturalWidth={naturalWidth}
					naturalHeight={naturalHeight}
					type="gif"
					handlePress={openImagePreview}
					channelId={channelId}
					messageId={messageId}
					attachmentId={attachmentId}
					embedIndex={embedIndex}
					contentHash={contentHash}
					message={message}
				>
					<div className={styles.videoWrapper}>
						{(!loaded || error) && thumbHashURL && (
							<img src={thumbHashURL} className={styles.thumbHashPlaceholder} alt={t`Loading placeholder`} />
						)}
						<img
							ref={imgRef}
							alt={t`Animated GIF`}
							src={gifAutoPlay ? optimizedAnimatedURL : optimizedStaticURL}
							className={clsx(
								styles.videoElement,
								!loaded && !error ? styles.videoOpacityHidden : styles.videoOpacityVisible,
							)}
							data-embed-media="gif"
							loading="lazy"
							tabIndex={-1}
							width={renderedDimensions.width}
							height={renderedDimensions.height}
						/>
					</div>
				</ImagePreviewHandler>
				<AltTextBadge altText={alt} onPopoutToggle={messageViewContext?.onPopoutToggle} />
			</MediaContainer>
		);
	},
);
