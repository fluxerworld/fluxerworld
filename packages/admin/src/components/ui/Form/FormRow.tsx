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

export interface FormRowProps {
	cols?: 1 | 2 | 3 | 4;
	gap?: 2 | 3 | 4 | 5 | 6;
	class?: string;
}

const colsStyles: Record<NonNullable<FormRowProps['cols']>, string> = {
	1: 'grid-cols-1',
	2: 'grid-cols-1 md:grid-cols-2',
	3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
	4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

const gapStyles: Record<NonNullable<FormRowProps['gap']>, string> = {
	2: 'gap-2',
	3: 'gap-3',
	4: 'gap-4',
	5: 'gap-5',
	6: 'gap-6',
};

export function FormRow(props: PropsWithChildren<FormRowProps>) {
	const {cols = 2, gap = 4, children, class: className} = props;

	return <div class={cn('grid', colsStyles[cols], gapStyles[gap], className)}>{children}</div>;
}
