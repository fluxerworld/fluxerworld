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

import type {ChildrenProps, GapProps, GridProps, InfoItemProps} from '@fluxer/ui/src/types/Common';
import type {PropsWithChildren} from 'hono/jsx';

export interface FlexRowProps extends GapProps {}

export interface StackProps extends GapProps {}

export function FlexRow({gap = '3', children}: PropsWithChildren<FlexRowProps>) {
	return <div class={`flex items-center gap-${gap}`}>{children}</div>;
}

export function FlexRowBetween({children}: ChildrenProps) {
	return <div class="flex flex-wrap items-center justify-between gap-3">{children}</div>;
}

export function Stack({gap = '4', children}: PropsWithChildren<StackProps>) {
	return <div class={`space-y-${gap}`}>{children}</div>;
}

export function Grid({cols = '2', gap = '4', children}: PropsWithChildren<GridProps>) {
	return <div class={`grid grid-cols-${cols} gap-${gap}`}>{children}</div>;
}

export function InfoItem({label, value}: InfoItemProps) {
	return (
		<div>
			<div class="mb-1 font-medium text-neutral-600 text-sm">{label}</div>
			<div class="text-neutral-900 text-sm">{value ?? '-'}</div>
		</div>
	);
}

export function InfoGrid({children}: ChildrenProps) {
	return <div class="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">{children}</div>;
}
