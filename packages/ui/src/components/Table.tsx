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

import type {ChildrenProps, LabelProps, MutedProps} from '@fluxer/ui/src/types/Common';
import type {PropsWithChildren} from 'hono/jsx';

export interface TableHeaderCellProps extends LabelProps {}

export interface TableCellProps extends MutedProps {
	colSpan?: number;
}

export function TableContainer({children}: ChildrenProps) {
	return <div class="overflow-hidden overflow-x-auto rounded-lg border border-neutral-200 bg-white">{children}</div>;
}

export function Table({children}: ChildrenProps) {
	return <table class="min-w-full divide-y divide-neutral-200">{children}</table>;
}

export function TableHead({children}: ChildrenProps) {
	return <thead class="bg-neutral-50">{children}</thead>;
}

export function TableBody({children}: ChildrenProps) {
	return <tbody class="divide-y divide-neutral-200 bg-white">{children}</tbody>;
}

export function TableRow({children}: ChildrenProps) {
	return <tr class="transition-colors hover:bg-neutral-50">{children}</tr>;
}

export function TableHeaderCell({label}: TableHeaderCellProps) {
	return <th class="px-6 py-3 text-left text-neutral-600 text-xs uppercase tracking-wider">{label}</th>;
}

export function TableCell({muted, colSpan, children}: PropsWithChildren<TableCellProps>) {
	return (
		<td class={`px-6 py-4 text-sm ${muted ? 'text-neutral-600' : 'text-neutral-900'}`} colspan={colSpan}>
			{children}
		</td>
	);
}
