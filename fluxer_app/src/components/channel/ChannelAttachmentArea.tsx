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

import * as MediaViewerActionCreators from '@app/actions/MediaViewerActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import styles from '@app/components/channel/ChannelAttachmentArea.module.css';
import EmbedVideo from '@app/components/channel/embeds/media/EmbedVideo';
import {computeHorizontalDropPosition} from '@app/components/layout/dnd/DndDropPosition';
import {type AttachmentDragItem, type AttachmentDropResult, DND_TYPES} from '@app/components/layout/types/DndTypes';
import {AttachmentEditModal} from '@app/components/modals/AttachmentEditModal';
import * as Modal from '@app/components/modals/Modal';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller} from '@app/components/uikit/Scroller';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useTextareaAttachments} from '@app/hooks/useCloudUpload';
import {type CloudAttachment, CloudUpload} from '@app/lib/CloudUpload';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import MessageStore from '@app/stores/MessageStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {isEmbeddableImageFile} from '@app/utils/EmbeddableImageTypes';
import {formatFileSize} from '@app/utils/FileUtils';
import {MessageAttachmentFlags} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {
	EyeIcon,
	EyeSlashIcon,
	FileAudioIcon,
	FileCodeIcon,
	FileIcon,
	FilePdfIcon,
	FileTextIcon,
	FileZipIcon,
	type Icon,
	PencilIcon,
	TrashIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {ConnectableElement} from 'react-dnd';
import {useDrag, useDrop} from 'react-dnd';
import {getEmptyImage} from 'react-dnd-html5-backend';

const getFileExtension = (filename: string): string => {
	const ext = filename.split('.').pop()?.toLowerCase() || '';
	return ext.length > 0 && ext.length <= 4 ? ext : '';
};

const getFileIcon = (file: File): Icon => {
	const mimeType = file.type.toLowerCase();
	const extension = file.name.split('.').pop()?.toLowerCase() || '';

	if (mimeType.startsWith('audio/')) {
		return FileAudioIcon;
	}

	if (mimeType === 'application/pdf') {
		return FilePdfIcon;
	}

	if (mimeType.startsWith('text/') || ['txt', 'md', 'markdown', 'rtf'].includes(extension)) {
		return FileTextIcon;
	}

	if (
		[
			'application/zip',
			'application/x-zip-compressed',
			'application/x-rar-compressed',
			'application/x-7z-compressed',
		].includes(mimeType) ||
		['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)
	) {
		return FileZipIcon;
	}

	if (
		mimeType.startsWith('application/') &&
		[
			'js',
			'ts',
			'jsx',
			'tsx',
			'html',
			'css',
			'json',
			'xml',
			'py',
			'java',
			'cpp',
			'c',
			'cs',
			'php',
			'rb',
			'go',
			'rs',
			'swift',
		].includes(extension)
	) {
		return FileCodeIcon;
	}

	return FileIcon;
};

const isAttachmentMedia = (attachment: CloudAttachment): boolean => {
	if (attachment.file.type.startsWith('video/')) {
		return attachment.previewURL !== null || attachment.thumbnailURL !== null;
	}

	if (isEmbeddableImageFile(attachment.file)) {
		return attachment.previewURL !== null;
	}

	return false;
};

const VideoPreviewModal = observer(({file, width, height}: {file: File; width: number; height: number}) => {
	const {t} = useLingui();

	const [blobUrl, setBlobUrl] = useState<string | null>(null);

	useEffect(() => {
		const url = URL.createObjectURL(file);
		setBlobUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	if (!blobUrl) return null;

	return (
		<Modal.Root className={styles.videoModal}>
			<Modal.ScreenReaderLabel text={t`Video`} />
			<div className={styles.videoContainer}>
				<EmbedVideo src={blobUrl} width={width} height={height} />
			</div>
		</Modal.Root>
	);
});

const SortableAttachmentItem = observer(
	({
		attachment,
		channelId,
		isSortingList = false,
		onAttachmentDrop,
		onDragStateChange,
	}: {
		attachment: CloudAttachment;
		channelId: string;
		isSortingList?: boolean;
		onAttachmentDrop?: (item: AttachmentDragItem, result: AttachmentDropResult) => void;
		onDragStateChange?: (item: AttachmentDragItem | null) => void;
	}) => {
		const {t} = useLingui();
		const itemRef = useRef<HTMLLIElement | null>(null);
		const mobileLayout = MobileLayoutStore;

		const [spoilerHidden, setSpoilerHidden] = useState(true);
		const [dropIndicator, setDropIndicator] = useState<'left' | 'right' | null>(null);
		const isSpoiler = (attachment.flags & MessageAttachmentFlags.IS_SPOILER) !== 0;

		const dragItemData: AttachmentDragItem = {
			type: DND_TYPES.ATTACHMENT,
			id: attachment.id,
			channelId,
		};

		const [{isDragging}, dragRef, preview] = useDrag(
			() => ({
				type: DND_TYPES.ATTACHMENT,
				item: () => {
					onDragStateChange?.(dragItemData);
					return dragItemData;
				},
				canDrag: !mobileLayout.enabled,
				collect: (monitor) => ({isDragging: monitor.isDragging()}),
				end: () => {
					onDragStateChange?.(null);
					setDropIndicator(null);
				},
			}),
			[dragItemData, mobileLayout.enabled, onDragStateChange],
		);

		const [{isOver}, dropRef] = useDrop(
			() => ({
				accept: DND_TYPES.ATTACHMENT,
				canDrop: (item: AttachmentDragItem) => item.id !== attachment.id,
				hover: (item: AttachmentDragItem, monitor) => {
					if (item.id === attachment.id) {
						setDropIndicator(null);
						return;
					}
					const node = itemRef.current;
					if (!node) return;
					const hoverBoundingRect = node.getBoundingClientRect();
					const clientOffset = monitor.getClientOffset();
					if (!clientOffset) return;
					const dropPos = computeHorizontalDropPosition(clientOffset, hoverBoundingRect);
					setDropIndicator(dropPos === 'before' ? 'left' : 'right');
				},
				drop: (item: AttachmentDragItem, monitor): AttachmentDropResult | undefined => {
					if (!monitor.canDrop()) {
						setDropIndicator(null);
						return;
					}
					const node = itemRef.current;
					if (!node) return;
					const hoverBoundingRect = node.getBoundingClientRect();
					const clientOffset = monitor.getClientOffset();
					if (!clientOffset) return;
					const result: AttachmentDropResult = {
						targetId: attachment.id,
						position: computeHorizontalDropPosition(clientOffset, hoverBoundingRect),
					};
					onAttachmentDrop?.(item, result);
					setDropIndicator(null);
					return result;
				},
				collect: (monitor) => ({
					isOver: monitor.isOver({shallow: true}),
				}),
			}),
			[attachment.id, onAttachmentDrop],
		);

		useEffect(() => {
			if (!isOver) setDropIndicator(null);
		}, [isOver]);

		useEffect(() => {
			preview(getEmptyImage(), {captureDraggingState: true});
		}, [preview]);

		const dragConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dragRef(node);
			},
			[dragRef],
		);
		const dropConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dropRef(node);
			},
			[dropRef],
		);

		const setRefs = useCallback(
			(node: HTMLLIElement | null) => {
				itemRef.current = node;
				dragConnectorRef(node);
				dropConnectorRef(node);
			},
			[dragConnectorRef, dropConnectorRef],
		);

		useEffect(() => {
			if (isSpoiler) {
				setSpoilerHidden(true);
			}
		}, [isSpoiler]);

		const handleClick = () => {
			if (isSpoiler && spoilerHidden) {
				setSpoilerHidden(false);
				return;
			}

			if (isEmbeddableImageFile(attachment.file)) {
				if (!attachment.previewURL) return;

				MediaViewerActionCreators.openMediaViewer(
					[
						{
							src: attachment.previewURL,
							originalSrc: attachment.previewURL,
							naturalWidth: attachment.width,
							naturalHeight: attachment.height,
							type: 'image' as const,
							filename: attachment.file.name,
						},
					],
					0,
				);
			} else if (attachment.file.type.startsWith('video/')) {
				ModalActionCreators.push(
					modal(() => <VideoPreviewModal file={attachment.file} width={attachment.width} height={attachment.height} />),
				);
			}
		};

		const containerStyle: React.CSSProperties = {
			width: '200px',
			height: '200px',
			position: 'relative',
			opacity: isDragging ? 0.5 : 1,
			cursor: isDragging ? 'grabbing' : 'default',
		};

		const isMedia = isAttachmentMedia(attachment);
		const isHiddenSpoiler = isSpoiler && spoilerHidden;
		const IconComponent = getFileIcon(attachment.file);

		return (
			<li
				ref={setRefs}
				style={containerStyle}
				className={clsx(
					styles.upload,
					dropIndicator === 'left' && styles.dropIndicatorLeft,
					dropIndicator === 'right' && styles.dropIndicatorRight,
				)}
				tabIndex={-1}
			>
				<div className={styles.uploadContainer}>
					{isMedia ? (
						<div className={styles.mediaContainer}>
							<button type="button" className={styles.clickableMedia} onClick={handleClick}>
								<div
									className={clsx(
										styles.spoilerContainer,
										isHiddenSpoiler && styles.hidden,
										isHiddenSpoiler && styles.hiddenSpoiler,
									)}
								>
									{isHiddenSpoiler && (
										<div className={clsx(styles.spoilerWarning, styles.obscureWarning)}>{t`Spoiler`}</div>
									)}

									<div className={styles.spoilerInnerContainer} aria-hidden={isHiddenSpoiler}>
										<div className={styles.spoilerWrapper}>
											{isEmbeddableImageFile(attachment.file) ? (
												<ImageThumbnail attachment={attachment} spoiler={isHiddenSpoiler} />
											) : attachment.file.type.startsWith('video/') ? (
												<VideoThumbnail attachment={attachment} spoiler={isHiddenSpoiler} />
											) : null}
											<div className={styles.tags}>
												{isSpoiler && !spoilerHidden && <span className={styles.altTag}>{t`Spoiler`}</span>}
											</div>
										</div>
									</div>
								</div>
							</button>
						</div>
					) : (
						<div className={styles.icon}>
							<button type="button" className={styles.clickableMedia} onClick={handleClick}>
								<div
									className={clsx(
										styles.spoilerContainer,
										isHiddenSpoiler && styles.hidden,
										isHiddenSpoiler && styles.hiddenSpoiler,
									)}
								>
									{isHiddenSpoiler && (
										<div className={clsx(styles.spoilerWarning, styles.obscureWarning)}>{t`Spoiler`}</div>
									)}
									<div className={styles.spoilerInnerContainer} aria-hidden={isHiddenSpoiler}>
										<div className={styles.spoilerWrapper}>
											<IconComponent
												className={clsx(styles.iconImage, isHiddenSpoiler && styles.spoiler)}
												weight="fill"
												aria-label={attachment.filename}
											/>
											<div className={styles.tags}>
												{isSpoiler && !spoilerHidden && <span className={styles.altTag}>{t`Spoiler`}</span>}
											</div>
										</div>
									</div>
								</div>
							</button>
						</div>
					)}

					<div className={styles.filenameContainer}>
						<Tooltip text={attachment.filename}>
							<div className={styles.filename}>{attachment.filename}</div>
						</Tooltip>
						<div className={styles.fileDetails}>
							<span className={styles.fileSize}>{formatFileSize(attachment.file.size)}</span>
							<span className={styles.fileExtension}>{getFileExtension(attachment.filename)}</span>
						</div>
					</div>

					{!isSortingList && (
						<div className={styles.actionBarContainer}>
							{attachment.status === 'failed' ? (
								<div className={styles.actionBar}>
									<AttachmentActionBarButton
										icon={TrashIcon}
										label={t`Remove Attachment`}
										danger={true}
										onClick={() => CloudUpload.removeAttachment(channelId, attachment.id)}
									/>
								</div>
							) : (
								<AttachmentActionBar channelId={channelId} attachment={attachment} />
							)}
						</div>
					)}
				</div>
			</li>
		);
	},
);

export const ChannelAttachmentArea = observer(({channelId}: {channelId: string}) => {
	const attachments = useTextareaAttachments(channelId);
	const prevAttachmentsLength = useRef<number | null>(null);
	const wasAtBottomBeforeChange = useRef<boolean>(true);
	const [isDragging, setIsDragging] = useState(false);

	const handleAttachmentDrop = useCallback(
		(item: AttachmentDragItem, result: AttachmentDropResult) => {
			const sourceId = item.id;
			const targetId = result.targetId;
			if (sourceId === targetId) return;

			const oldIndex = attachments.findIndex((attachment: CloudAttachment) => attachment.id === sourceId);
			const targetIndex = attachments.findIndex((attachment: CloudAttachment) => attachment.id === targetId);
			if (oldIndex === -1 || targetIndex === -1) return;

			let newIndex = result.position === 'after' ? targetIndex + 1 : targetIndex;
			if (oldIndex < targetIndex && result.position === 'after') newIndex--;

			const newArray = [...attachments];
			const [movedItem] = newArray.splice(oldIndex, 1);
			newArray.splice(newIndex, 0, movedItem);

			CloudUpload.reorderAttachments(channelId, newArray);
		},
		[attachments, channelId],
	);

	const handleDragStateChange = useCallback((item: AttachmentDragItem | null) => {
		setIsDragging(item !== null);
	}, []);

	if (attachments.length !== prevAttachmentsLength.current) {
		const scrollerElement = document.querySelector('.scroller-base') as HTMLElement | null;
		if (scrollerElement) {
			const isNearBottom =
				scrollerElement.scrollHeight <= scrollerElement.scrollTop + scrollerElement.offsetHeight + 16;
			wasAtBottomBeforeChange.current = isNearBottom;
		}
	}

	useLayoutEffect(() => {
		const currentLength = attachments.length;
		const previousLength = prevAttachmentsLength.current;

		if (previousLength !== null && previousLength !== currentLength) {
			if ((previousLength === 0 && currentLength > 0) || (previousLength > 0 && currentLength === 0)) {
				if (wasAtBottomBeforeChange.current) {
					const messages = MessageStore.getMessages(channelId);
					if (messages.hasMoreAfter) {
						ComponentDispatch.dispatch('FORCE_JUMP_TO_PRESENT');
					}
				}
			}

			ComponentDispatch.dispatch('LAYOUT_RESIZED');
		}
		prevAttachmentsLength.current = currentLength;
	}, [attachments, channelId]);

	if (attachments.length === 0) {
		return null;
	}

	return (
		<>
			<Scroller key="channel-attachment-scroller" orientation="horizontal" fade={false} className={styles.scroller}>
				<ul className={styles.channelAttachmentArea}>
					{attachments.map((attachment: CloudAttachment) => (
						<SortableAttachmentItem
							key={attachment.id}
							attachment={attachment}
							channelId={channelId}
							isSortingList={isDragging}
							onAttachmentDrop={handleAttachmentDrop}
							onDragStateChange={handleDragStateChange}
						/>
					))}
				</ul>
			</Scroller>
			<div className={styles.divider} />
		</>
	);
});

const ImageThumbnail = observer(({attachment, spoiler}: {attachment: CloudAttachment; spoiler: boolean}) => {
	const [hasError, setHasError] = useState(false);
	const src = attachment.previewURL;

	if (hasError || !src) return null;

	return (
		<img
			src={src}
			className={clsx(styles.media, spoiler && styles.spoiler)}
			aria-hidden={true}
			alt={attachment.filename}
			onError={() => setHasError(true)}
		/>
	);
});

const VideoThumbnail = observer(({attachment, spoiler}: {attachment: CloudAttachment; spoiler: boolean}) => {
	const [hasError, setHasError] = useState(false);
	const src = attachment.thumbnailURL || attachment.previewURL;

	if (hasError || !src) return null;

	return (
		<img
			src={src}
			alt={attachment.filename}
			className={clsx(styles.media, spoiler && styles.spoiler)}
			onError={() => setHasError(true)}
		/>
	);
});

const AttachmentActionBarButton = observer(
	({
		label,
		icon: Icon,
		onClick,
		danger = false,
	}: {
		label: string;
		icon: Icon;
		onClick: (event: React.MouseEvent | React.KeyboardEvent) => void;
		danger?: boolean;
	}) => {
		const handleClick = (event: React.MouseEvent | React.KeyboardEvent) => {
			event.preventDefault();
			event.stopPropagation();
			onClick(event);
		};

		return (
			<Tooltip text={label}>
				<FocusRing offset={-2}>
					<button
						type="button"
						aria-label={label}
						onClick={handleClick}
						className={clsx(styles.button, danger && styles.danger)}
					>
						<Icon className={styles.actionBarIcon} />
					</button>
				</FocusRing>
			</Tooltip>
		);
	},
);

const AttachmentActionBar = observer(({channelId, attachment}: {channelId: string; attachment: CloudAttachment}) => {
	const {t} = useLingui();

	const isSpoiler = (attachment.flags & MessageAttachmentFlags.IS_SPOILER) !== 0;

	const toggleSpoiler = () => {
		const nextFlags = isSpoiler
			? attachment.flags & ~MessageAttachmentFlags.IS_SPOILER
			: attachment.flags | MessageAttachmentFlags.IS_SPOILER;

		CloudUpload.updateAttachment(channelId, attachment.id, {
			flags: nextFlags,
			spoiler: !isSpoiler,
		});
	};

	const editAttachment = () => {
		ModalActionCreators.push(modal(() => <AttachmentEditModal channelId={channelId} attachment={attachment} />));
	};

	const removeAttachment = () => {
		CloudUpload.removeAttachment(channelId, attachment.id);
	};

	return (
		<div className={styles.actionBarContainer}>
			<div className={styles.actionBar} role="toolbar" aria-label={t`Attachment Actions`}>
				<AttachmentActionBarButton
					icon={isSpoiler ? EyeSlashIcon : EyeIcon}
					label={isSpoiler ? t`Remove Spoiler` : t`Spoiler Attachment`}
					onClick={toggleSpoiler}
				/>
				<AttachmentActionBarButton icon={PencilIcon} label={t`Edit Attachment`} onClick={editAttachment} />
				<AttachmentActionBarButton
					icon={TrashIcon}
					label={t`Remove Attachment`}
					danger={true}
					onClick={removeAttachment}
				/>
			</div>
		</div>
	);
});
