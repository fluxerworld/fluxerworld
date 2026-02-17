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

export type FlexDirection = 'row' | 'col' | 'row-reverse' | 'col-reverse';
export type FlexAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
export type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type FlexWrap = 'wrap' | 'nowrap' | 'wrap-reverse';

export interface FlexProps {
	direction?: FlexDirection;
	align?: FlexAlign;
	justify?: FlexJustify;
	gap?: number | string;
	wrap?: FlexWrap;
}

const directionClasses: Record<FlexDirection, string> = {
	row: 'flex-row',
	col: 'flex-col',
	'row-reverse': 'flex-row-reverse',
	'col-reverse': 'flex-col-reverse',
};

const alignClasses: Record<FlexAlign, string> = {
	start: 'items-start',
	center: 'items-center',
	end: 'items-end',
	baseline: 'items-baseline',
	stretch: 'items-stretch',
};

const justifyClasses: Record<FlexJustify, string> = {
	start: 'justify-start',
	center: 'justify-center',
	end: 'justify-end',
	between: 'justify-between',
	around: 'justify-around',
	evenly: 'justify-evenly',
};

const wrapClasses: Record<FlexWrap, string> = {
	wrap: 'flex-wrap',
	nowrap: 'flex-nowrap',
	'wrap-reverse': 'flex-wrap-reverse',
};

function getGapClass(gap: number | string): string {
	if (typeof gap === 'number') {
		return `gap-${gap}`;
	}
	return gap;
}

export function Flex({
	direction = 'row',
	align = 'stretch',
	justify = 'start',
	gap,
	wrap = 'nowrap',
	children,
}: PropsWithChildren<FlexProps>) {
	const classes = cn(
		'flex',
		directionClasses[direction],
		alignClasses[align],
		justifyClasses[justify],
		gap !== undefined && getGapClass(gap),
		wrapClasses[wrap],
	);

	return <div class={classes}>{children}</div>;
}
