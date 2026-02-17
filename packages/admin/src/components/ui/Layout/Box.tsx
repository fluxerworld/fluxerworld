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

import {cn} from '@fluxer/admin/src/utils/ClassNames';
import type {PropsWithChildren} from 'hono/jsx';

export type BoxSpacing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type BoxBackground = 'white' | 'gray-50' | 'gray-100' | 'transparent';
export type BoxBorder = 'none' | 'gray-200' | 'gray-300';
export type BoxRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface BoxProps {
	p?: BoxSpacing;
	m?: BoxSpacing;
	bg?: BoxBackground;
	border?: BoxBorder;
	rounded?: BoxRounded;
}

const backgroundClasses: Record<BoxBackground, string> = {
	white: 'bg-white',
	'gray-50': 'bg-gray-50',
	'gray-100': 'bg-gray-100',
	transparent: 'bg-transparent',
};

const borderClasses: Record<BoxBorder, string> = {
	none: '',
	'gray-200': 'border border-gray-200',
	'gray-300': 'border border-gray-300',
};

const roundedClasses: Record<BoxRounded, string> = {
	none: 'rounded-none',
	sm: 'rounded-sm',
	md: 'rounded-md',
	lg: 'rounded-lg',
	xl: 'rounded-xl',
	'2xl': 'rounded-2xl',
	full: 'rounded-full',
};

function getPaddingClass(p: BoxSpacing): string {
	return `p-${p}`;
}

function getMarginClass(m: BoxSpacing): string {
	return `m-${m}`;
}

export function Box({
	p,
	m,
	bg = 'transparent',
	border = 'none',
	rounded = 'none',
	children,
}: PropsWithChildren<BoxProps>) {
	const classes = cn(
		p !== undefined && getPaddingClass(p),
		m !== undefined && getMarginClass(m),
		backgroundClasses[bg],
		borderClasses[border],
		roundedClasses[rounded],
	);

	return <div class={classes}>{children}</div>;
}
