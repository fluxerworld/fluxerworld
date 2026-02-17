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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

export type ColorTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary' | 'purple' | 'orange';
export type ColorIntensity = 'subtle' | 'normal' | 'strong';

export interface ColorVariant {
	bg: string;
	text: string;
	border?: string;
}

export const colorVariants: Record<ColorTone, Record<ColorIntensity, ColorVariant>> = {
	neutral: {
		subtle: {bg: 'bg-neutral-50', text: 'text-neutral-700', border: 'border-neutral-200'},
		normal: {bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200'},
		strong: {bg: 'bg-neutral-900', text: 'text-white'},
	},
	info: {
		subtle: {bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200'},
		normal: {bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200'},
		strong: {bg: 'bg-blue-600', text: 'text-white'},
	},
	success: {
		subtle: {bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200'},
		normal: {bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200'},
		strong: {bg: 'bg-green-600', text: 'text-white'},
	},
	warning: {
		subtle: {bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200'},
		normal: {bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200'},
		strong: {bg: 'bg-yellow-600', text: 'text-white'},
	},
	danger: {
		subtle: {bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200'},
		normal: {bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200'},
		strong: {bg: 'bg-red-600', text: 'text-white'},
	},
	primary: {
		subtle: {bg: 'bg-neutral-100', text: 'text-neutral-700'},
		normal: {bg: 'bg-neutral-900', text: 'text-white'},
		strong: {bg: 'bg-neutral-900', text: 'text-white'},
	},
	purple: {
		subtle: {bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200'},
		normal: {bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200'},
		strong: {bg: 'bg-purple-600', text: 'text-white'},
	},
	orange: {
		subtle: {bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200'},
		normal: {bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200'},
		strong: {bg: 'bg-orange-600', text: 'text-white'},
	},
};

export function getColorClasses(tone: ColorTone, intensity: ColorIntensity = 'normal'): string {
	const variant = colorVariants[tone][intensity];
	const classes = [variant.bg, variant.text];
	if (variant.border) {
		classes.push(variant.border);
	}
	return classes.join(' ');
}

export type AlertTone = 'error' | 'warning' | 'success' | 'info';

export function getAlertClasses(tone: AlertTone): string {
	const toneMapping: Record<AlertTone, ColorTone> = {
		error: 'danger',
		warning: 'warning',
		success: 'success',
		info: 'info',
	};
	return getColorClasses(toneMapping[tone], 'subtle');
}
