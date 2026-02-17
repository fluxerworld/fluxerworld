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

export type GridCols = 1 | 2 | 3 | 4;
export type GridGap = 'sm' | 'md' | 'lg';

export interface GridProps {
	cols?: GridCols;
	gap?: GridGap;
	class?: string;
}

const colsClasses: Record<GridCols, string> = {
	1: 'md:grid-cols-1',
	2: 'md:grid-cols-2',
	3: 'md:grid-cols-3',
	4: 'md:grid-cols-4',
};

const gapClasses: Record<GridGap, string> = {
	sm: 'gap-2',
	md: 'gap-4',
	lg: 'gap-6',
};

export function Grid({cols = 2, gap = 'md', class: className, children}: PropsWithChildren<GridProps>) {
	const classes = cn('grid grid-cols-1', colsClasses[cols], gapClasses[gap], className);

	return <div class={classes}>{children}</div>;
}
