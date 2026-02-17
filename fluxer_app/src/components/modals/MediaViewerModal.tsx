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
import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {deriveDefaultNameFromMessage} from '@app/components/channel/embeds/EmbedUtils';
import {AudioPlayer} from '@app/components/media_player/components/AudioPlayer';
import {VideoPlayer} from '@app/components/media_player/components/VideoPlayer';
import {AddFavoriteMemeModal} from '@app/components/modals/AddFavoriteMemeModal';
import {MediaModal} from '@app/components/modals/MediaModal';
import styles from '@app/components/modals/MediaViewerModal.module.css';
import {useMediaMenuData} from '@app/components/uikit/context_menu/items/MediaMenuData';
import {MediaContextMenu} from '@app/components/uikit/context_menu/MediaContextMenu';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {Platform} from '@app/lib/Platform';
import type {MessageRecord} from '@app/records/MessageRecord';
import FavoriteMemeStore from '@app/stores/FavoriteMemeStore';
import MediaViewerStore, {type MediaViewerItem} from '@app/stores/MediaViewerStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {formatAttachmentDate} from '@app/utils/AttachmentExpiryUtils';
import {createSaveHandler} from '@app/utils/FileDownloadUtils';
import * as ImageCacheUtils from '@app/utils/ImageCacheUtils';
import {buildMediaProxyURL, stripMediaProxyParams} from '@app/utils/MediaProxyUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {useLingui} from '@lingui/react/macro';
import {TrashIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {type CSSProperties, type FC, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';

interface MobileMediaOptionsSheetProps {
	currentItem: MediaViewerItem;
	defaultName: string;
	isOpen: boolean;
	message: MessageRecord;
	onClose: () => void;
	onDelete: (bypassConfirm?: boolean) => void;
}

function getBaseProxyURL(src: string): string {
	if (src.startsWith('blob:')) {
		return src;
	}

	return stripMediaProxyParams(src);
}

const MobileMediaOptionsSheet: FC<MobileMediaOptionsSheetProps> = observer(function MobileMediaOptionsSheet({
	currentItem,
	defaultName,
	isOpen,
	message,
	onClose,
	onDelete,
}: MobileMediaOptionsSheetProps) {
	const {t} = useLingui();

	const mediaMenuData = useMediaMenuData(
		{
			message,
			originalSrc: currentItem.originalSrc,
			proxyURL: currentItem.src,
			type: currentItem.type,
			contentHash: currentItem.contentHash,
			attachmentId: currentItem.attachmentId,
			embedIndex: currentItem.embedIndex,
			defaultName,
			defaultAltText: undefined,
		},
		{
			onClose,
		},
	);

	const mediaMenuGroupsWithDelete = useMemo(
		() => [
			...mediaMenuData.groups,
			{
				items: [
					{
						label: t`Delete Message`,
						icon: <TrashIcon size={20} />,
						onClick: () => {
							onDelete();
							onClose();
						},
						danger: true,
					},
				],
			},
		],
		[mediaMenuData.groups, onClose, onDelete, t],
	);

	return (
		<MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={mediaMenuGroupsWithDelete} title={t`Media Options`} />
	);
});

const MediaViewerModalComponent: FC = observer(() => {
	const {t, i18n} = useLingui();
	const {isOpen, items, currentIndex, channelId, messageId, message} = MediaViewerStore;
	const {enabled: isMobile} = MobileLayoutStore;
	const videoRef = useRef<HTMLVideoElement>(null);
	const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);

	const currentItem = items[currentIndex];

	useEffect(() => {
		if (currentItem?.type !== 'gifv') return;
		const video = videoRef.current;
		if (!video) return;

		video.autoplay = true;
		video.loop = true;
		video.muted = true;
		video.playsInline = true;
		void video.play().catch(() => {});
	}, [currentItem?.src, currentItem?.type, currentIndex]);

	useEffect(() => {
		if (!isOpen || items.length <= 1) return;

		const preloadIndices = [currentIndex - 1, currentIndex + 1].filter(
			(i) => i >= 0 && i < items.length && i !== currentIndex,
		);

		for (const idx of preloadIndices) {
			const item = items[idx];
			if (!item) continue;

			if (item.type === 'image' || item.type === 'gif') {
				const isItemBlob = item.src.startsWith('blob:');
				if (isItemBlob) continue;
				const baseProxyURL = getBaseProxyURL(item.src);

				const shouldRequestAnimated = item.animated || item.type === 'gif';
				let preloadSrc: string;

				if (shouldRequestAnimated) {
					preloadSrc = buildMediaProxyURL(baseProxyURL, {
						format: 'webp',
						animated: true,
					});
				} else {
					const maxPreviewSize = 1920;
					const aspectRatio = item.naturalWidth / item.naturalHeight;
					let targetWidth = item.naturalWidth;
					let targetHeight = item.naturalHeight;

					if (item.naturalWidth > maxPreviewSize || item.naturalHeight > maxPreviewSize) {
						if (aspectRatio > 1) {
							targetWidth = Math.min(item.naturalWidth, maxPreviewSize);
							targetHeight = Math.round(targetWidth / aspectRatio);
						} else {
							targetHeight = Math.min(item.naturalHeight, maxPreviewSize);
							targetWidth = Math.round(targetHeight * aspectRatio);
						}
					}

					preloadSrc = buildMediaProxyURL(baseProxyURL, {
						format: 'webp',
						width: targetWidth,
						height: targetHeight,
						animated: item.animated,
					});
				}

				if (!ImageCacheUtils.hasImage(preloadSrc)) {
					ImageCacheUtils.loadImage(preloadSrc, () => {});
				}
			} else if (item.type === 'gifv' || item.type === 'video') {
				const video = document.createElement('video');
				video.preload = 'metadata';
				video.src = item.src;
				video.load();
			}
		}
	}, [isOpen, currentIndex, items]);

	const memes = FavoriteMemeStore.memes;
	const isFavorited = currentItem?.contentHash
		? memes.some((meme) => meme.contentHash === currentItem.contentHash)
		: false;

	const defaultName = deriveDefaultNameFromMessage({
		message,
		attachmentId: currentItem?.attachmentId,
		url: currentItem?.originalSrc,
		proxyUrl: currentItem?.src,
		i18nInstance: i18n,
	});

	const handleFavoriteClick = useCallback(async () => {
		if (!channelId || !messageId || !currentItem) return;

		if (isFavorited && currentItem.contentHash) {
			const meme = memes.find((m) => m.contentHash === currentItem.contentHash);
			if (!meme) return;
			await FavoriteMemeActionCreators.deleteFavoriteMeme(i18n, meme.id);
		} else {
			ModalActionCreators.push(
				modal(() => (
					<AddFavoriteMemeModal
						channelId={channelId}
						messageId={messageId}
						attachmentId={currentItem.attachmentId}
						embedIndex={currentItem.embedIndex}
						defaultName={defaultName}
					/>
				)),
			);
		}
	}, [channelId, messageId, currentItem, defaultName, i18n, isFavorited, memes]);

	const handleSave = useCallback(() => {
		if (!currentItem) return;
		const mediaType = (() => {
			if (currentItem.type === 'audio') return 'audio';
			if (currentItem.type === 'video') return 'video';
			return 'image';
		})();
		createSaveHandler(currentItem.originalSrc, mediaType)();
	}, [currentItem]);

	const handleOpenInBrowser = useCallback(() => {
		if (!currentItem) return;
		void openExternalUrl(currentItem.originalSrc);
	}, [currentItem]);

	const handleDelete = useCallback(
		(bypassConfirm?: boolean) => {
			if (!message) return;

			if (bypassConfirm) {
				MessageActionCreators.remove(message.channelId, message.id);
				return;
			}

			MessageActionCreators.showDeleteConfirmation(i18n, {message});
		},
		[i18n, message],
	);

	const handlePrevious = useCallback(() => {
		MediaViewerActionCreators.navigateMediaViewer((currentIndex - 1 + items.length) % items.length);
	}, [currentIndex, items.length]);

	const handleNext = useCallback(() => {
		MediaViewerActionCreators.navigateMediaViewer((currentIndex + 1) % items.length);
	}, [currentIndex, items.length]);

	const handleThumbnailSelect = useCallback(
		(index: number) => {
			if (index === currentIndex) return;
			MediaViewerActionCreators.navigateMediaViewer(index);
		},
		[currentIndex],
	);

	const handleContextMenu = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!currentItem || !message) return;

			const renderMenu = ({onClose}: {onClose: () => void}) => (
				<MediaContextMenu
					message={message}
					originalSrc={currentItem.originalSrc}
					proxyURL={currentItem.src}
					type={currentItem.type}
					contentHash={currentItem.contentHash}
					attachmentId={currentItem.attachmentId}
					embedIndex={currentItem.embedIndex}
					defaultName={defaultName}
					onClose={onClose}
					onDelete={handleDelete}
				/>
			);

			event.stopPropagation?.();

			if (Platform.isElectron) {
				event.preventDefault();
				ContextMenuActionCreators.openFromEvent(event, renderMenu);
				return;
			}

			ContextMenuActionCreators.openAtPoint(
				{
					x: event.pageX + 2,
					y: event.pageY + 2,
				},
				renderMenu,
			);
		},
		[currentItem, defaultName, handleDelete, message],
	);

	const handleMenuOpen = useCallback(() => {
		if (!currentItem || !message) return;
		if (isMobile) {
			setIsMediaMenuOpen(true);
		} else {
			ContextMenuActionCreators.openAtPoint({x: window.innerWidth / 2, y: window.innerHeight / 2}, ({onClose}) => (
				<MediaContextMenu
					message={message}
					originalSrc={currentItem.originalSrc}
					proxyURL={currentItem.src}
					type={currentItem.type}
					contentHash={currentItem.contentHash}
					attachmentId={currentItem.attachmentId}
					embedIndex={currentItem.embedIndex}
					defaultName={defaultName}
					onClose={onClose}
					onDelete={handleDelete}
				/>
			));
		}
	}, [currentItem, defaultName, handleDelete, message, isMobile]);

	const isBlob = currentItem?.src.startsWith('blob:');

	const imageSrc = useMemo(() => {
		if (!currentItem) return '';
		if (isBlob) {
			return currentItem.src;
		}
		const baseProxyURL = getBaseProxyURL(currentItem.src);

		const shouldRequestAnimated = currentItem.animated || currentItem.type === 'gif';
		if (shouldRequestAnimated) {
			return buildMediaProxyURL(baseProxyURL, {
				format: 'webp',
				animated: true,
			});
		}

		if (currentItem.type === 'gifv' || currentItem.type === 'video' || currentItem.type === 'audio') {
			return baseProxyURL;
		}

		const maxPreviewSize = 1920;
		const aspectRatio = currentItem.naturalWidth / currentItem.naturalHeight;

		let targetWidth = currentItem.naturalWidth;
		let targetHeight = currentItem.naturalHeight;

		if (currentItem.naturalWidth > maxPreviewSize || currentItem.naturalHeight > maxPreviewSize) {
			if (aspectRatio > 1) {
				targetWidth = Math.min(currentItem.naturalWidth, maxPreviewSize);
				targetHeight = Math.round(targetWidth / aspectRatio);
			} else {
				targetHeight = Math.min(currentItem.naturalHeight, maxPreviewSize);
				targetWidth = Math.round(targetHeight * aspectRatio);
			}
		}

		return buildMediaProxyURL(baseProxyURL, {
			format: 'webp',
			width: targetWidth,
			height: targetHeight,
			animated: currentItem.animated,
		});
	}, [currentItem, isBlob]);

	const thumbnails = useMemo(
		() =>
			items.map((item, index) => {
				const name = item.filename || item.originalSrc.split('/').pop()?.split('?')[0] || t`Attachment ${index + 1}`;
				if ((item.type === 'image' || item.type === 'gif' || item.animated) && !item.src.startsWith('blob:')) {
					const baseProxyURL = getBaseProxyURL(item.src);
					return {
						src: buildMediaProxyURL(baseProxyURL, {
							format: 'webp',
							width: 320,
							height: 320,
							animated: Boolean(item.animated),
						}),
						alt: name,
						type: item.type,
					};
				}

				return {
					src: item.src,
					alt: name,
					type: item.type,
				};
			}),
		[items, t],
	);

	if (!isOpen || !currentItem) {
		return null;
	}

	const dimensions =
		currentItem.naturalWidth && currentItem.naturalHeight
			? `${currentItem.naturalWidth}×${currentItem.naturalHeight}`
			: undefined;
	const fileName = currentItem.filename || currentItem.originalSrc.split('/').pop()?.split('?')[0] || 'media';
	const expiryInfo =
		currentItem.expiresAt && currentItem.expiresAt.length > 0
			? {
					expiresAt: new Date(currentItem.expiresAt),
					isExpired: currentItem.expired ?? false,
					label: formatAttachmentDate(new Date(currentItem.expiresAt)),
				}
			: undefined;

	const getTitle = () => {
		if (currentItem.type === 'image') {
			return currentItem.animated ? t`Animated image preview` : t`Image preview`;
		}
		if (currentItem.type === 'gif' || currentItem.type === 'gifv') {
			return t`GIF preview`;
		}
		if (currentItem.type === 'video') {
			return t`Video preview`;
		}
		if (currentItem.type === 'audio') {
			return t`Audio preview`;
		}
		return t`Media preview`;
	};

	const modalTitle = getTitle();

	const renderMedia = () => {
		if (currentItem.type === 'gifv') {
			const isActualGif = currentItem.src.endsWith('.gif') || currentItem.originalSrc.endsWith('.gif');

			if (isActualGif) {
				return (
					<img
						src={imageSrc}
						alt={t`Animated GIF`}
						className={styles.gifvImage}
						style={{
							objectFit: 'contain',
						}}
						draggable={false}
					/>
				);
			}

			return (
				<video
					key={currentItem.src}
					ref={videoRef}
					src={currentItem.src}
					className={styles.gifvVideo}
					style={{
						objectFit: 'contain',
					}}
					autoPlay
					loop
					muted
					playsInline
					controls={false}
					aria-label={t`Animated video`}
				>
					<track kind="captions" />
				</video>
			);
		}

		if (currentItem.type === 'video') {
			const hasNaturalVideoDimensions = currentItem.naturalWidth > 0 && currentItem.naturalHeight > 0;
			const videoAspectRatio = hasNaturalVideoDimensions
				? `${currentItem.naturalWidth} / ${currentItem.naturalHeight}`
				: '16 / 9';

			return (
				<div
					className={styles.videoPlayerContainer}
					style={
						{
							'--video-natural-width': hasNaturalVideoDimensions ? `${currentItem.naturalWidth}px` : '960px',
							'--video-aspect-ratio': hasNaturalVideoDimensions
								? currentItem.naturalWidth / currentItem.naturalHeight
								: 16 / 9,
							aspectRatio: videoAspectRatio,
						} as CSSProperties
					}
				>
					<VideoPlayer
						src={currentItem.src}
						width={currentItem.naturalWidth}
						height={currentItem.naturalHeight}
						duration={currentItem.duration}
						autoPlay
						fillContainer
						isMobile={isMobile}
						className={styles.videoPlayer}
					/>
				</div>
			);
		}

		if (currentItem.type === 'audio') {
			return (
				<div className={styles.mediaContainer}>
					<div className={styles.audioPlayerContainer}>
						<AudioPlayer
							src={currentItem.src}
							title={fileName}
							duration={currentItem.duration}
							autoPlay
							isMobile={isMobile}
							className={styles.audioPlayer}
						/>
					</div>
				</div>
			);
		}

		const imageAlt = (() => {
			if (currentItem.type === 'gif') return t`Animated GIF`;
			if (currentItem.animated) return t`Animated image`;
			return t`Image`;
		})();

		return (
			<img
				src={imageSrc}
				alt={imageAlt}
				className={styles.image}
				style={{
					objectFit: 'contain',
				}}
				draggable={false}
			/>
		);
	};

	const canFavoriteCurrentItem =
		Boolean(channelId) &&
		Boolean(messageId) &&
		(currentItem.type === 'image' ||
			currentItem.type === 'gif' ||
			currentItem.type === 'gifv' ||
			currentItem.type === 'video');

	return (
		<>
			<MediaModal
				title={modalTitle}
				fileName={fileName}
				expiryInfo={
					expiryInfo
						? {
								expiresAt: expiryInfo.expiresAt,
								isExpired: expiryInfo.isExpired,
							}
						: undefined
				}
				dimensions={dimensions}
				isFavorited={canFavoriteCurrentItem ? isFavorited : undefined}
				onFavorite={canFavoriteCurrentItem ? handleFavoriteClick : undefined}
				onSave={currentItem.type !== 'gifv' ? handleSave : undefined}
				onOpenInBrowser={handleOpenInBrowser}
				enablePanZoom={currentItem.type === 'image' || currentItem.type === 'gif' || currentItem.type === 'gifv'}
				currentIndex={currentIndex}
				totalAttachments={items.length}
				onPrevious={items.length > 1 ? handlePrevious : undefined}
				onNext={items.length > 1 ? handleNext : undefined}
				thumbnails={thumbnails}
				onSelectThumbnail={handleThumbnailSelect}
				providerName={currentItem.providerName}
				videoSrc={currentItem.type === 'video' ? currentItem.src : undefined}
				initialTime={currentItem.initialTime}
				mediaType={currentItem.type === 'audio' ? 'audio' : currentItem.type === 'video' ? 'video' : 'image'}
				onMenuOpen={handleMenuOpen}
			>
				<div
					className={styles.mediaContextMenuWrapper}
					onContextMenu={handleContextMenu}
					role="region"
					aria-label={modalTitle}
				>
					{renderMedia()}
				</div>
			</MediaModal>

			{isMobile && message && (
				<MobileMediaOptionsSheet
					currentItem={currentItem}
					defaultName={defaultName}
					isOpen={isMediaMenuOpen}
					message={message}
					onClose={() => setIsMediaMenuOpen(false)}
					onDelete={handleDelete}
				/>
			)}
		</>
	);
});

export const MediaViewerModal: FC = MediaViewerModalComponent;
