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
import * as FavoriteMemeActionCreators from '@app/actions/FavoriteMemeActionCreators';
import * as MediaViewerActionCreators from '@app/actions/MediaViewerActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {AltTextBadge} from '@app/components/channel/embeds/AltTextBadge';
import {getMediaButtonVisibility} from '@app/components/channel/embeds/media/MediaButtonUtils';
import {MediaContainer} from '@app/components/channel/embeds/media/MediaContainer';
import {NSFWBlurOverlay} from '@app/components/channel/embeds/NSFWBlurOverlay';
import {MediaActionBottomSheet} from '@app/components/channel/MediaActionBottomSheet';
import {useMaybeMessageViewContext} from '@app/components/channel/MessageViewContext';
import {SpoilerOverlay} from '@app/components/common/SpoilerOverlay';
import spoilerStyles from '@app/components/common/SpoilerOverlay.module.css';
import {AddFavoriteMemeModal} from '@app/components/modals/AddFavoriteMemeModal';
import type {MediaType} from '@app/components/uikit/context_menu/items/MediaMenuData';
import {MediaContextMenu} from '@app/components/uikit/context_menu/MediaContextMenu';
import {useDeleteAttachment} from '@app/hooks/useDeleteAttachment';
import {useNSFWMedia} from '@app/hooks/useNSFWMedia';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import FavoriteMemeStore from '@app/stores/FavoriteMemeStore';
import styles from '@app/styles/AttachmentGridItem.module.css';
import * as FavoriteMemeUtils from '@app/utils/FavoriteMemeUtils';
import {createSaveHandler} from '@app/utils/FileDownloadUtils';
import * as ImageCacheUtils from '@app/utils/ImageCacheUtils';
import {getMosaicMediaDimensions} from '@app/utils/MediaDimensionConfig';
import {buildMediaProxyURL} from '@app/utils/MediaProxyUtils';
import {attachmentsToViewerItems, determineMediaType, findViewerItemIndex} from '@app/utils/MediaViewerItemUtils';
import {useSpoilerState} from '@app/utils/SpoilerUtils';
import {MessageAttachmentFlags} from '@fluxer/constants/src/ChannelConstants';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {PlayIcon, SpeakerHighIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type {CSSProperties, FC, KeyboardEvent, MouseEvent, ReactElement} from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {thumbHashToDataURL} from 'thumbhash';

export type LayoutType =
	| 'single'
	| 'grid'
	| 'mosaic'
	| 'two'
	| 'three'
	| 'four'
	| 'five'
	| 'six'
	| 'seven'
	| 'eight'
	| 'nine'
	| 'ten';

export interface AttachmentGridItemProps {
	attachment: MessageAttachment;
	style?: CSSProperties;
	message?: MessageRecord;
	mediaAttachments: ReadonlyArray<MessageAttachment>;
	isPreview?: boolean;
	targetAspectRatio?: string;
}

interface MediaLoadingState {
	loaded: boolean;
	error: boolean;
	thumbHashURL?: string;
}

const useMediaLoading = (src: string, placeholder?: string): MediaLoadingState => {
	const [loadingState, setLoadingState] = useState<Omit<MediaLoadingState, 'thumbHashURL'>>({
		loaded: ImageCacheUtils.hasImage(src),
		error: false,
	});

	const thumbHashURL = useMemo(() => {
		if (!placeholder) return undefined;
		try {
			const bytes = Uint8Array.from(atob(placeholder), (c) => c.charCodeAt(0));
			return thumbHashToDataURL(bytes);
		} catch {
			return undefined;
		}
	}, [placeholder]);

	useEffect(() => {
		if (DeveloperOptionsStore.forceRenderPlaceholders || DeveloperOptionsStore.forceMediaLoading) {
			return;
		}

		ImageCacheUtils.loadImage(
			src,
			() => setLoadingState({loaded: true, error: false}),
			() => setLoadingState({loaded: false, error: true}),
		);
	}, [src]);

	return {...loadingState, thumbHashURL};
};

export const AttachmentGridItem: FC<AttachmentGridItemProps> = observer(
	({attachment, style, message, mediaAttachments, isPreview, targetAspectRatio}) => {
		const {i18n, t} = useLingui();
		const messageViewContext = useMaybeMessageViewContext();
		const attachmentMediaType = determineMediaType(attachment);
		const isVideo = attachmentMediaType === 'video';
		const isAudio = attachmentMediaType === 'audio';
		const isGifv = attachmentMediaType === 'gifv';
		const isAnimatedGif = attachmentMediaType === 'gif' || isGifv;
		const isSpoiler = (attachment.flags & MessageAttachmentFlags.IS_SPOILER) !== 0;
		const nsfw = attachment.nsfw || (attachment.flags & MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA) !== 0;

		const {hidden: spoilerHidden, reveal: revealSpoiler} = useSpoilerState(isSpoiler, message?.channelId);
		const {shouldBlur, gateReason} = useNSFWMedia(nsfw, message?.channelId);

		const wrapSpoiler = (node: ReactElement) =>
			isSpoiler ? (
				<SpoilerOverlay hidden={spoilerHidden} onReveal={revealSpoiler} className={spoilerStyles.media}>
					{node}
				</SpoilerOverlay>
			) : (
				node
			);

		const mosaicDimensions = getMosaicMediaDimensions(message);
		const maxMosaicWidth = mosaicDimensions.maxWidth;
		let targetWidth = maxMosaicWidth;
		let targetHeight = maxMosaicWidth;

		if (
			typeof attachment.width === 'number' &&
			attachment.width > 0 &&
			typeof attachment.height === 'number' &&
			attachment.height > 0
		) {
			targetWidth = Math.min(attachment.width, maxMosaicWidth * 2);
			targetHeight = Math.max(1, Math.round((targetWidth / attachment.width) * attachment.height));
		}

		const proxyUrl = attachment.proxy_url ?? attachment.url ?? '';
		const isBlob = proxyUrl.startsWith('blob:');

		const thumbnailSrc =
			proxyUrl.length === 0
				? ''
				: isBlob
					? proxyUrl
					: buildMediaProxyURL(proxyUrl, {
							format: 'webp',
							width: targetWidth,
							height: targetHeight,
							animated: isAnimatedGif,
						});

		const {loaded, error, thumbHashURL} = useMediaLoading(thumbnailSrc, attachment.placeholder);

		const memes = FavoriteMemeStore.memes;
		const isFavorited = attachment.content_hash
			? memes.some((meme) => meme.contentHash === attachment.content_hash)
			: false;

		const handleClick = useCallback(
			(event: MouseEvent | KeyboardEvent) => {
				if (shouldBlur) {
					event.preventDefault();
					event.stopPropagation();
					return;
				}

				if (event.type === 'keydown') {
					const keyEvent = event as KeyboardEvent;
					if (keyEvent.key !== 'Enter' && keyEvent.key !== ' ') {
						return;
					}
					event.preventDefault();
				}

				const items = attachmentsToViewerItems(mediaAttachments);
				const currentIndex = findViewerItemIndex(items, attachment.id);

				MediaViewerActionCreators.openMediaViewer(items, currentIndex, {
					channelId: message?.channelId,
					messageId: message?.id,
					message,
				});
			},
			[attachment, message, mediaAttachments, shouldBlur],
		);

		const handleFavoriteClick = useCallback(
			async (e: MouseEvent) => {
				e.stopPropagation();
				if (!message?.channelId || !message?.id) return;

				if (isFavorited && attachment.content_hash) {
					const meme = memes.find((m) => m.contentHash === attachment.content_hash);
					if (!meme) return;
					await FavoriteMemeActionCreators.deleteFavoriteMeme(i18n, meme.id);
				} else {
					const defaultName = FavoriteMemeUtils.deriveDefaultNameFromAttachment(i18n, attachment);
					ModalActionCreators.push(
						modal(() => (
							<AddFavoriteMemeModal
								channelId={message.channelId}
								messageId={message.id}
								attachmentId={attachment.id}
								defaultName={defaultName}
								defaultAltText={attachment.filename}
							/>
						)),
					);
				}
			},
			[message, attachment, isFavorited, memes, i18n],
		);

		const handleDownloadClick = useCallback(
			(e: MouseEvent) => {
				e.stopPropagation();
				const type = (() => {
					if (isAudio) return 'audio';
					if (isVideo || isGifv) return 'video';
					return 'image';
				})();
				createSaveHandler(attachment.url ?? '', type)();
			},
			[attachment.url, isAudio, isVideo, isGifv],
		);

		const isRealAttachment = !message?.attachments ? false : message.attachments.some((a) => a.id === attachment.id);

		const handleDeleteClick = useDeleteAttachment(message, isRealAttachment ? attachment.id : undefined);

		const [mediaSheetOpen, setMediaSheetOpen] = useState(false);

		const handleContextMenu = useCallback(
			(e: MouseEvent) => {
				if (!message || isPreview) return;

				e.preventDefault();
				e.stopPropagation();

				const mediaType = (() => {
					if (isAudio) return 'audio';
					if (isGifv) return 'gifv';
					if (isVideo) return 'video';
					return 'image';
				})();
				const defaultName = FavoriteMemeUtils.deriveDefaultNameFromAttachment(i18n, attachment);

				ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
					<MediaContextMenu
						message={message}
						originalSrc={attachment.url ?? ''}
						proxyURL={attachment.proxy_url ?? attachment.url ?? ''}
						type={mediaType}
						contentHash={attachment.content_hash}
						attachmentId={attachment.id}
						defaultName={defaultName}
						defaultAltText={attachment.filename}
						onClose={onClose}
						onDelete={isPreview ? () => {} : (messageViewContext?.handleDelete ?? (() => {}))}
					/>
				));
			},
			[message, attachment, isAudio, isVideo, isGifv, isPreview, i18n, messageViewContext],
		);

		const handleLongPress = useCallback(() => {
			if (!message || isPreview) return;
			setMediaSheetOpen(true);
		}, [message, isPreview]);

		const handleCloseMediaSheet = useCallback(() => {
			setMediaSheetOpen(false);
		}, []);

		const mediaType: MediaType = useMemo(() => {
			if (isAudio) return 'audio';
			if (isGifv) return 'gifv';
			if (isVideo) return 'video';
			if (isAnimatedGif) return 'gif';
			return 'image';
		}, [isAudio, isGifv, isVideo, isAnimatedGif]);

		const ariaLabel = useMemo(() => {
			if (isAudio) return t`Open audio in full view`;
			if (isVideo) return t`Open video in full view`;
			if (isGifv) return t`Open animated GIF video in full view`;
			if (isAnimatedGif) return t`Open animated GIF in full view`;
			return t`Open image in full view`;
		}, [isAudio, isVideo, isGifv, isAnimatedGif, t]);
		const shouldRenderPlaceholder = !loaded || error;

		const canFavorite = !!(message?.channelId && message?.id);
		const {showFavoriteButton, showDownloadButton, showDeleteButton} = getMediaButtonVisibility(
			canFavorite,
			isPreview ? undefined : message,
			isRealAttachment ? attachment.id : undefined,
			{disableDelete: !!isPreview},
		);

		const gridItemStyle: CSSProperties = {
			...style,
			...(targetAspectRatio ? {aspectRatio: targetAspectRatio} : {}),
		};

		const defaultName = useMemo(
			() => FavoriteMemeUtils.deriveDefaultNameFromAttachment(i18n, attachment),
			[i18n, attachment],
		);

		return wrapSpoiler(
			<>
				<MediaContainer
					className={styles.gridItem}
					style={gridItemStyle}
					showFavoriteButton={showFavoriteButton}
					isFavorited={isFavorited}
					onFavoriteClick={handleFavoriteClick}
					showDownloadButton={showDownloadButton}
					onDownloadClick={handleDownloadClick}
					showDeleteButton={showDeleteButton}
					onDeleteClick={handleDeleteClick}
					onContextMenu={handleContextMenu}
					onLongPress={handleLongPress}
				>
					<div
						role="button"
						tabIndex={0}
						className={styles.clickableButton}
						onClick={handleClick}
						onKeyDown={handleClick}
						aria-label={ariaLabel}
					>
						{isAudio ? (
							<div className={styles.audioPlaceholder}>
								<SpeakerHighIcon weight="fill" />
							</div>
						) : (
							<div className={styles.mediaContainer}>
								<div className={styles.loadingOverlay}>
									{isAnimatedGif && <div className={styles.gifIndicator}>GIF</div>}

									<AnimatePresence>
										{shouldRenderPlaceholder && thumbHashURL && (
											<motion.img
												key="placeholder"
												initial={{opacity: 1}}
												exit={{opacity: 0}}
												transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.3}}
												src={thumbHashURL}
												alt=""
												className={styles.placeholderImage}
											/>
										)}
									</AnimatePresence>

									<img
										src={thumbnailSrc}
										alt={attachment.filename}
										loading="lazy"
										draggable={false}
										className={clsx(
											styles.mediaImage,
											shouldRenderPlaceholder && styles.mediaImageHidden,
											shouldBlur && styles.mediaBlurred,
										)}
										aria-hidden={shouldBlur}
									/>

									<AltTextBadge altText={attachment.description} onPopoutToggle={messageViewContext?.onPopoutToggle} />
								</div>

								{shouldBlur && (
									<div className={styles.nsfwOverlay}>
										<NSFWBlurOverlay reason={gateReason} />
									</div>
								)}
							</div>
						)}

						{(isVideo || isAudio) && (
							<div className={styles.playButtonOverlay}>
								<div className={styles.playButton}>
									<PlayIcon size={28} weight="fill" aria-hidden="true" />
								</div>
							</div>
						)}
					</div>
				</MediaContainer>
				{message && (
					<MediaActionBottomSheet
						isOpen={mediaSheetOpen}
						onClose={handleCloseMediaSheet}
						message={message}
						originalSrc={attachment.url ?? ''}
						proxyURL={attachment.proxy_url ?? attachment.url ?? ''}
						type={mediaType}
						contentHash={attachment.content_hash}
						attachmentId={attachment.id}
						defaultName={defaultName}
						defaultAltText={attachment.filename}
						handleDelete={messageViewContext?.handleDelete}
					/>
				)}
			</>,
		);
	},
);
