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

export type HStackAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
export type HStackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export interface HStackProps {
	gap?: number | string;
	align?: HStackAlign;
	justify?: HStackJustify;
	class?: string;
}

const alignClasses: Record<HStackAlign, string> = {
	start: 'items-start',
	center: 'items-center',
	end: 'items-end',
	baseline: 'items-baseline',
	stretch: 'items-stretch',
};

const justifyClasses: Record<HStackJustify, string> = {
	start: 'justify-start',
	center: 'justify-center',
	end: 'justify-end',
	between: 'justify-between',
	around: 'justify-around',
	evenly: 'justify-evenly',
};

function getGapClass(gap: number | string): string {
	if (typeof gap === 'number') {
		return `gap-${gap}`;
	}
	return gap;
}

export function HStack({
	gap = 4,
	align = 'center',
	justify = 'start',
	class: className,
	children,
}: PropsWithChildren<HStackProps>) {
	const classes = cn('flex flex-row', getGapClass(gap), alignClasses[align], justifyClasses[justify], className);

	return <div class={classes}>{children}</div>;
}
