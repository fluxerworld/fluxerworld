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

export interface TableRowProps {
	hover?: boolean;
	selected?: boolean;
	clickable?: boolean;
}

export function TableRow({
	hover = true,
	selected = false,
	clickable = false,
	children,
}: PropsWithChildren<TableRowProps>) {
	return (
		<tr
			class={clsx(
				hover && 'transition-colors hover:bg-neutral-50',
				selected && 'bg-blue-50',
				clickable && 'cursor-pointer',
			)}
		>
			{children}
		</tr>
	);
}
