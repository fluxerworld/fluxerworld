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

import * as FavoriteMemeActionCreators from '@app/actions/FavoriteMemeActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {AddFavoriteMemeModal} from '@app/components/modals/AddFavoriteMemeModal';
import {EditAltTextModal} from '@app/components/modals/EditAltTextModal';
import {
	CopyLinkIcon,
	CopyMediaIcon,
	FavoriteIcon,
	OpenMediaLinkIcon,
	SaveMediaIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import type {MenuGroupType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {Logger} from '@app/lib/Logger';
import type {MessageRecord} from '@app/records/MessageRecord';
import FavoriteMemeStore from '@app/stores/FavoriteMemeStore';
import PermissionStore from '@app/stores/PermissionStore';
import UserStore from '@app/stores/UserStore';
import * as FavoriteMemeUtils from '@app/utils/FavoriteMemeUtils';
import {createSaveHandler} from '@app/utils/FileDownloadUtils';
import {buildMediaProxyURL, stripMediaProxyParams} from '@app/utils/MediaProxyUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {I18n} from '@lingui/core';
import {t} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {PencilSimpleIcon} from '@phosphor-icons/react';
import {autorun} from 'mobx';
import {useCallback, useMemo, useSyncExternalStore} from 'react';

const logger = new Logger('MediaMenuData');

export type MediaType = 'image' | 'gif' | 'gifv' | 'video' | 'audio' | 'file';

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error('Failed to encode PNG'));
				return;
			}

			resolve(blob);
		}, 'image/png');
	});
}

async function createImageBitmapWithOrientation(blob: Blob): Promise<ImageBitmap> {
	try {
		return await createImageBitmap(blob, {imageOrientation: 'from-image'});
	} catch {
		return await createImageBitmap(blob);
	}
}

async function convertImageBlobToPng(blob: Blob): Promise<Blob> {
	if (blob.type === 'image/png') return blob;
	if (blob.size === 0) {
		throw new Error('Image blob is empty');
	}

	const imageBitmap = await createImageBitmapWithOrientation(blob);
	try {
		if (typeof OffscreenCanvas !== 'undefined') {
			const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				throw new Error('OffscreenCanvas 2D context is unavailable');
			}

			ctx.drawImage(imageBitmap, 0, 0);
			if ('convertToBlob' in canvas) {
				return await canvas.convertToBlob({type: 'image/png'});
			}
		}

		const canvas = document.createElement('canvas');
		canvas.width = imageBitmap.width;
		canvas.height = imageBitmap.height;

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Canvas 2D context is unavailable');
		}

		ctx.drawImage(imageBitmap, 0, 0);
		return await canvasToPngBlob(canvas);
	} finally {
		imageBitmap.close?.();
	}
}

async function fetchFirstPngBlob(urls: Array<string>): Promise<Blob> {
	let lastError: unknown = null;

	for (const url of urls) {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Unexpected response status ${response.status} for ${url}`);
			}

			const blob = await response.blob();
			return await convertImageBlobToPng(blob);
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError ?? new Error('Failed to fetch and convert image');
}

export interface MediaMenuDataOptions {
	onClose: () => void;
}

export interface MediaMenuDataProps {
	message: MessageRecord;
	originalSrc: string;
	proxyURL?: string;
	type: MediaType;
	contentHash?: string | null;
	attachmentId?: string;
	embedIndex?: number;
	defaultName?: string;
	defaultAltText?: string;
}

export interface MediaMenuData {
	groups: Array<MenuGroupType>;
	handlers: MediaMenuHandlers;
	state: MediaMenuState;
}

export interface MediaMenuHandlers {
	handleAddToFavorites: () => void;
	handleRemoveFromFavorites: () => Promise<void>;
	handleEditAltText: () => void;
	handleCopyMedia: () => Promise<void>;
	handleSaveMedia: () => void;
	handleCopyLink: () => Promise<void>;
	handleOpenLink: () => void;
	handleCopyAttachmentId: () => Promise<void>;
}

export interface MediaMenuState {
	isFavorited: boolean;
	copyLabel: string;
	saveLabel: string;
}

function getCopyLabel(type: MediaType, i18n: I18n): string {
	switch (type) {
		case 'image':
			return t(i18n)`Copy Image`;
		case 'gif':
		case 'gifv':
			return t(i18n)`Copy GIF`;
		case 'video':
			return t(i18n)`Copy Video`;
		case 'audio':
			return t(i18n)`Copy Audio`;
		case 'file':
			return t(i18n)`Copy Link`;
		default:
			return t(i18n)`Copy Media`;
	}
}

function getSaveLabel(type: MediaType, i18n: I18n): string {
	switch (type) {
		case 'image':
			return t(i18n)`Save Image`;
		case 'gif':
		case 'gifv':
			return t(i18n)`Save GIF`;
		case 'video':
			return t(i18n)`Save Video`;
		case 'audio':
			return t(i18n)`Save Audio`;
		case 'file':
			return t(i18n)`Save File`;
		default:
			return t(i18n)`Save Media`;
	}
}

export function useMediaMenuData(props: MediaMenuDataProps, options: MediaMenuDataOptions): MediaMenuData {
	const {i18n} = useLingui();
	const {onClose} = options;
	const {message, originalSrc, proxyURL, type, contentHash, attachmentId, embedIndex, defaultName, defaultAltText} =
		props;

	const memes = useSyncExternalStore(
		(listener) => {
			const dispose = autorun(listener);
			return () => dispose();
		},
		() => FavoriteMemeStore.memes,
	);

	const isFavorited = contentHash ? memes.some((meme) => meme.contentHash === contentHash) : false;
	const currentUserId = UserStore.currentUserId;
	const canManageMessages = PermissionStore.can(Permissions.MANAGE_MESSAGES, {channelId: message.channelId});
	const canEditAltText = useMemo(() => {
		if (!attachmentId) return false;

		const attachment = message.attachments.find((att) => att.id === attachmentId);
		const mimeType = attachment?.content_type?.toLowerCase() ?? '';
		const canEditMedia = mimeType.startsWith('image/') || mimeType.startsWith('video/');
		if (!canEditMedia) return false;

		const isMessageAuthor = currentUserId === message.author?.id;
		return isMessageAuthor || canManageMessages;
	}, [attachmentId, canManageMessages, currentUserId, message]);

	const handleAddToFavorites = useCallback(() => {
		ModalActionCreators.push(
			modal(() => (
				<AddFavoriteMemeModal
					channelId={message.channelId}
					messageId={message.id}
					attachmentId={attachmentId}
					embedIndex={embedIndex}
					defaultName={
						defaultName ||
						FavoriteMemeUtils.deriveDefaultNameFromEmbedMedia(i18n, {
							url: originalSrc,
							proxy_url: originalSrc,
							flags: 0,
						})
					}
					defaultAltText={defaultAltText}
				/>
			)),
		);
		onClose();
	}, [message, attachmentId, embedIndex, defaultName, defaultAltText, originalSrc, onClose, i18n]);

	const handleRemoveFromFavorites = useCallback(async () => {
		if (!contentHash) return;

		const meme = memes.find((m) => m.contentHash === contentHash);
		if (!meme) return;

		await FavoriteMemeActionCreators.deleteFavoriteMeme(i18n, meme.id);
		onClose();
	}, [contentHash, memes, onClose, i18n]);

	const handleEditAltText = useCallback(() => {
		if (!canEditAltText || !attachmentId) return;

		const attachment = message.attachments.find((att) => att.id === attachmentId);
		const currentDescription = attachment?.description ?? null;

		ModalActionCreators.push(
			modal(() => (
				<EditAltTextModal
					message={message}
					attachmentId={attachmentId}
					currentDescription={currentDescription}
					onClose={() => ModalActionCreators.pop()}
				/>
			)),
		);
		onClose();
	}, [canEditAltText, message, attachmentId, onClose]);

	const handleCopyMedia = useCallback(async () => {
		if (!originalSrc) {
			ToastActionCreators.createToast({
				type: 'error',
				children: t(i18n)`Attachment is expired or unavailable`,
			});
			onClose();
			return;
		}

		if (type === 'video' || type === 'gifv' || type === 'gif' || type === 'audio' || type === 'file') {
			await TextCopyActionCreators.copy(i18n, originalSrc, true);
			ToastActionCreators.createToast({
				type: 'success',
				children: type === 'file' ? t(i18n)`Link copied to clipboard` : t(i18n)`URL copied to clipboard`,
			});
			onClose();
			return;
		}

		const baseProxyURL = proxyURL ? stripMediaProxyParams(proxyURL) : null;
		const urlsToTry: Array<string> = [];
		if (baseProxyURL) urlsToTry.push(buildMediaProxyURL(baseProxyURL, {format: 'png'}));
		if (baseProxyURL) urlsToTry.push(baseProxyURL);
		urlsToTry.push(originalSrc);
		let toastId: string | null = null;

		try {
			toastId = ToastActionCreators.createToast({
				type: 'info',
				children: t(i18n)`Copying image...`,
				timeout: 0,
			});

			// Safari/WebKit requires `clipboard.write()` to be called directly within the user gesture.
			// Passing a Promise keeps the gesture context while we fetch + convert.
			if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
				throw new Error('Clipboard image write is unavailable');
			}

			await navigator.clipboard.write([
				new ClipboardItem({
					'image/png': fetchFirstPngBlob(urlsToTry),
				}),
			]);

			if (toastId) ToastActionCreators.destroyToast(toastId);
			ToastActionCreators.createToast({
				type: 'success',
				children: t(i18n)`Image copied to clipboard`,
			});
			onClose();
		} catch (error) {
			logger.error('Failed to copy image to clipboard:', error);
			if (toastId) ToastActionCreators.destroyToast(toastId);

			await TextCopyActionCreators.copy(i18n, originalSrc, true);
			ToastActionCreators.createToast({
				type: 'success',
				children: t(i18n)`URL copied to clipboard`,
			});
			onClose();
		}
	}, [originalSrc, proxyURL, type, onClose, i18n]);

	const handleSaveMedia = useCallback(() => {
		if (!originalSrc) {
			ToastActionCreators.createToast({
				type: 'error',
				children: t(i18n)`Attachment is expired or unavailable`,
			});
			onClose();
			return;
		}

		const mediaType: 'image' | 'video' | 'audio' | 'file' = (() => {
			if (type === 'video' || type === 'gifv') return 'video';
			if (type === 'audio') return 'audio';
			if (type === 'file') return 'file';
			return 'image';
		})();

		const baseProxyURL = proxyURL ? stripMediaProxyParams(proxyURL) : null;
		const urlToSave = baseProxyURL || originalSrc;

		createSaveHandler(urlToSave, mediaType)();
		onClose();
	}, [originalSrc, proxyURL, type, onClose, i18n]);

	const handleCopyLink = useCallback(async () => {
		if (!originalSrc) {
			ToastActionCreators.createToast({
				type: 'error',
				children: t(i18n)`Attachment is expired or unavailable`,
			});
			onClose();
			return;
		}

		await TextCopyActionCreators.copy(i18n, originalSrc, true);
		ToastActionCreators.createToast({
			type: 'success',
			children: t(i18n)`Link copied to clipboard`,
		});
		onClose();
	}, [originalSrc, onClose, i18n]);

	const handleOpenLink = useCallback(() => {
		if (!originalSrc) {
			ToastActionCreators.createToast({
				type: 'error',
				children: t(i18n)`Attachment is expired or unavailable`,
			});
			onClose();
			return;
		}

		void openExternalUrl(originalSrc);
		onClose();
	}, [originalSrc, onClose, i18n]);

	const handleCopyAttachmentId = useCallback(async () => {
		if (!attachmentId) return;

		await TextCopyActionCreators.copy(i18n, attachmentId, true);
		ToastActionCreators.createToast({
			type: 'success',
			children: t(i18n)`Attachment ID copied to clipboard`,
		});
		onClose();
	}, [attachmentId, onClose, i18n]);

	const copyLabel = useMemo(() => getCopyLabel(type, i18n), [type, i18n]);
	const saveLabel = useMemo(() => getSaveLabel(type, i18n), [type, i18n]);

	const handlers: MediaMenuHandlers = useMemo(
		() => ({
			handleAddToFavorites,
			handleRemoveFromFavorites,
			handleEditAltText,
			handleCopyMedia,
			handleSaveMedia,
			handleCopyLink,
			handleOpenLink,
			handleCopyAttachmentId,
		}),
		[
			handleAddToFavorites,
			handleRemoveFromFavorites,
			handleEditAltText,
			handleCopyMedia,
			handleSaveMedia,
			handleCopyLink,
			handleOpenLink,
			handleCopyAttachmentId,
		],
	);

	const state: MediaMenuState = useMemo(
		() => ({
			isFavorited,
			copyLabel,
			saveLabel,
		}),
		[isFavorited, copyLabel, saveLabel],
	);

	const groups = useMemo(() => {
		const result: Array<MenuGroupType> = [];

		result.push({
			items: [
				isFavorited
					? {
							icon: <FavoriteIcon filled size={20} />,
							label: t(i18n)`Remove from Favorites`,
							onClick: handleRemoveFromFavorites,
						}
					: {
							icon: <FavoriteIcon size={20} />,
							label: t(i18n)`Add to Favorites`,
							onClick: handleAddToFavorites,
						},
			],
		});

		if (canEditAltText) {
			result.push({
				items: [
					{
						icon: <PencilSimpleIcon size={20} />,
						label: t(i18n)`Edit Alt Text`,
						onClick: handleEditAltText,
					},
				],
			});
		}

		result.push({
			items: [
				{
					icon: <CopyMediaIcon size={20} />,
					label: copyLabel,
					onClick: handleCopyMedia,
				},
				{
					icon: <SaveMediaIcon size={20} />,
					label: saveLabel,
					onClick: handleSaveMedia,
				},
				...(type === 'file'
					? []
					: [
							{
								icon: <CopyLinkIcon size={20} />,
								label: t(i18n)`Copy Link`,
								onClick: handleCopyLink,
							},
						]),
				{
					icon: <OpenMediaLinkIcon size={20} />,
					label: t(i18n)`Open Link`,
					onClick: handleOpenLink,
				},
			],
		});

		return result;
	}, [
		isFavorited,
		copyLabel,
		saveLabel,
		message,
		handleAddToFavorites,
		handleRemoveFromFavorites,
		handleEditAltText,
		handleCopyMedia,
		handleSaveMedia,
		handleCopyLink,
		handleOpenLink,
		canEditAltText,
		i18n,
	]);

	return {
		groups,
		handlers,
		state,
	};
}
