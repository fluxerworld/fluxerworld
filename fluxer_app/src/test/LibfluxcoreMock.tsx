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

export default async function initLibfluxcore(): Promise<void> {
	return;
}

export function is_animated_image(_data: Uint8Array): boolean {
	return false;
}

export function crop_and_rotate_gif(
	gif: Uint8Array,
	_x: number,
	_y: number,
	_width: number,
	_height: number,
	_rotation: number,
	_resizeWidth: number | null,
	_resizeHeight: number | null,
): Uint8Array {
	return gif;
}

export function crop_and_rotate_image(
	image: Uint8Array,
	_format: string,
	_x: number,
	_y: number,
	_width: number,
	_height: number,
	_rotation: number,
	_resizeWidth: number | null,
	_resizeHeight: number | null,
): Uint8Array {
	return image;
}

export function crop_and_rotate_apng(
	apng: Uint8Array,
	_x: number,
	_y: number,
	_width: number,
	_height: number,
	_rotation: number,
	_resizeWidth: number | null,
	_resizeHeight: number | null,
): Uint8Array {
	return apng;
}

export function decompress_zstd_frame(input: Uint8Array): Uint8Array {
	return input;
}
