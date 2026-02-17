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

export type StackGap = 'sm' | 'md' | 'lg' | number;
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';

export interface StackProps {
	gap?: StackGap;
	align?: StackAlign;
	class?: string;
}

const gapClasses: Record<string, string> = {
	sm: 'gap-2',
	md: 'gap-4',
	lg: 'gap-6',
};

const alignClasses: Record<StackAlign, string> = {
	start: 'items-start',
	center: 'items-center',
	end: 'items-end',
	stretch: 'items-stretch',
};

function getGapClass(gap: StackGap): string {
	if (typeof gap === 'number') {
		return `gap-${gap}`;
	}
	return gapClasses[gap] ?? gapClasses.md;
}

export function Stack({gap = 'md', align = 'stretch', class: className, children}: PropsWithChildren<StackProps>) {
	const classes = cn('flex flex-col', getGapClass(gap), alignClasses[align], className);

	return <div class={classes}>{children}</div>;
}
