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

import {detectAnimatedImage} from '@app/lib/LibFluxcore';

const GIF_EXT = '.gif';
const WEBP_EXT = '.webp';
const PNG_EXT = '.png';
const AVIF_EXT = '.avif';

export type AnimatedImageFormat = 'gif' | 'webp' | 'avif' | 'apng';

function getFileExtension(file: File): string {
	const name = (file.name || '').toLowerCase();
	const dotIndex = name.lastIndexOf('.');
	return dotIndex === -1 ? '' : name.substring(dotIndex);
}

export async function isAnimatedFile(file: File): Promise<boolean> {
	try {
		const arrayBuffer = await file.arrayBuffer();
		return await detectAnimatedImage(new Uint8Array(arrayBuffer));
	} catch {
		return false;
	}
}

export function getAnimatedFormatLabel(file: File): string {
	const mime = (file.type || '').toLowerCase();
	const ext = getFileExtension(file);

	if (mime.includes('gif') || ext === GIF_EXT) {
		return 'GIF';
	}
	if (mime.includes('webp') || ext === WEBP_EXT) {
		return 'WebP';
	}
	if (mime.includes('png') || ext === PNG_EXT) {
		return 'APNG';
	}
	if (mime.includes('avif') || ext === AVIF_EXT) {
		return 'AVIF';
	}

	return 'image';
}

export function getAnimatedImageFormat(mime: string, ext?: string): AnimatedImageFormat {
	const lowerMime = mime.toLowerCase();
	const lowerExt = ext?.toLowerCase() || '';

	if (lowerMime.includes('gif') || lowerExt === '.gif') {
		return 'gif';
	}
	if (lowerMime.includes('webp') || lowerExt === '.webp') {
		return 'webp';
	}
	if (lowerMime.includes('avif') || lowerExt === '.avif') {
		return 'avif';
	}
	if (lowerMime.includes('png') || lowerExt === '.png') {
		return 'apng';
	}

	return 'gif';
}

export interface HandleAnimatedNonGifOptions {
	file: File;
	isGif: boolean;
	animated: boolean;
	onAnimatedAvif: () => void;
	onOtherAnimated: () => void;
}

export function shouldShowAnimatedAvifConfirmation({
	file,
	isGif,
	animated,
	onAnimatedAvif,
	onOtherAnimated,
}: HandleAnimatedNonGifOptions): boolean {
	if (!animated || isGif) {
		return false;
	}

	const format = getAnimatedImageFormat(file.type);

	if (format === 'avif') {
		onAnimatedAvif();
		return true;
	}

	onOtherAnimated();
	return true;
}
