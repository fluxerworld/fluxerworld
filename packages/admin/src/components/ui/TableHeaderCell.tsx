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

import clsx from 'clsx';
import type {PropsWithChildren} from 'hono/jsx';

export interface TableHeaderCellProps {
	align?: 'left' | 'center' | 'right';
}

export function TableHeaderCell({align = 'left', children}: PropsWithChildren<TableHeaderCellProps>) {
	return (
		<th
			class={clsx(
				'whitespace-nowrap px-6 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider',
				align === 'left' && 'text-left',
				align === 'center' && 'text-center',
				align === 'right' && 'text-right',
			)}
		>
			{children}
		</th>
	);
}
