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

const pad2 = (value: string): string => (value.length === 1 ? `0${value}` : value);

export function int2hex(colorInt: number) {
	const r = (colorInt >> 16) & 0xff;
	const g = (colorInt >> 8) & 0xff;
	const b = colorInt & 0xff;
	return `#${pad2(r.toString(16))}${pad2(g.toString(16))}${pad2(b.toString(16))}`;
}

export function int2rgba(colorInt: number, alpha?: number) {
	if (alpha == null) {
		alpha = ((colorInt >> 24) & 0xff) / 255;
	}

	const r = (colorInt >> 16) & 0xff;
	const g = (colorInt >> 8) & 0xff;
	const b = colorInt & 0xff;

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function int2rgb(colorInt: number) {
	if (colorInt === 0) {
		return 'rgb(219, 222, 225)';
	}
	const r = (colorInt >> 16) & 0xff;
	const g = (colorInt >> 8) & 0xff;
	const b = colorInt & 0xff;
	return `rgb(${r}, ${g}, ${b})`;
}

export function getBestContrastColor(colorInt: number): 'black' | 'white' {
	if (colorInt === 0) {
		return 'black';
	}

	const r = (colorInt >> 16) & 0xff;
	const g = (colorInt >> 8) & 0xff;
	const b = colorInt & 0xff;

	const rsRGB = r / 255;
	const gsRGB = g / 255;
	const bsRGB = b / 255;

	const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : ((rsRGB + 0.055) / 1.055) ** 2.4;
	const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : ((gsRGB + 0.055) / 1.055) ** 2.4;
	const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : ((bsRGB + 0.055) / 1.055) ** 2.4;

	const luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;

	return luminance > 0.5 ? 'black' : 'white';
}

export const AVATAR_BACKGROUND_DIM_AMOUNT = 0.12;

function clampChannel(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function dimHexColor(color: string, amount: number): string | null {
	const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
	if (!match) return null;

	const hex = match[1];
	const r = Number.parseInt(hex.slice(0, 2), 16);
	const g = Number.parseInt(hex.slice(2, 4), 16);
	const b = Number.parseInt(hex.slice(4, 6), 16);

	const factor = 1 - amount;
	return `rgb(${clampChannel(r * factor)}, ${clampChannel(g * factor)}, ${clampChannel(b * factor)})`;
}

function dimRgbColor(color: string, amount: number): string | null {
	const match = /^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i.exec(color.trim());
	if (!match) return null;

	const r = Number(match[1]);
	const g = Number(match[2]);
	const b = Number(match[3]);

	const factor = 1 - amount;
	return `rgb(${clampChannel(r * factor)}, ${clampChannel(g * factor)}, ${clampChannel(b * factor)})`;
}

export function dimColor(color: string, amount = AVATAR_BACKGROUND_DIM_AMOUNT): string {
	const clampedAmount = Math.max(0, Math.min(1, amount));
	return dimHexColor(color, clampedAmount) ?? dimRgbColor(color, clampedAmount) ?? color;
}
