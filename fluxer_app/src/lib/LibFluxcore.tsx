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

import {Logger} from '@app/lib/Logger';
import initLibfluxcore, * as wasm from '@pkgs/libfluxcore/libfluxcore';

const logger = new Logger('libfluxcore');
let modulePromise: Promise<void> | null = null;

async function loadModule(): Promise<void> {
	if (!modulePromise) {
		modulePromise = (async () => {
			try {
				if (typeof initLibfluxcore === 'function') {
					await initLibfluxcore();
				}
			} catch (err) {
				logger.warn('Failed to load wasm module', err);
				throw err;
			}
		})();
	}
	await modulePromise;
}

export async function ensureLibfluxcoreReady(): Promise<void> {
	await loadModule();
}

export async function detectAnimatedImage(data: Uint8Array): Promise<boolean> {
	await loadModule();
	const result = wasm.is_animated_image(data);
	return Boolean(result);
}

export function cropAndRotateGif(
	gif: Uint8Array,
	x: number,
	y: number,
	width: number,
	height: number,
	rotation: number,
	resizeWidth: number | null,
	resizeHeight: number | null,
): Uint8Array {
	const result = wasm.crop_and_rotate_gif(gif, x, y, width, height, rotation, resizeWidth, resizeHeight);
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}

export function cropAndRotateImage(
	image: Uint8Array,
	format: string,
	x: number,
	y: number,
	width: number,
	height: number,
	rotation: number,
	resizeWidth: number | null,
	resizeHeight: number | null,
): Uint8Array {
	const result = wasm.crop_and_rotate_image(image, format, x, y, width, height, rotation, resizeWidth, resizeHeight);
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}

export async function cropAndRotateApng(
	apng: Uint8Array,
	x: number,
	y: number,
	width: number,
	height: number,
	rotation: number,
	resizeWidth: number | null,
	resizeHeight: number | null,
): Promise<Uint8Array> {
	await loadModule();
	const result = wasm.crop_and_rotate_apng(apng, x, y, width, height, rotation, resizeWidth, resizeHeight);
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}

export async function decompressZstdFrame(input: Uint8Array): Promise<Uint8Array | null> {
	await loadModule();
	const result = wasm.decompress_zstd_frame(input);
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}
