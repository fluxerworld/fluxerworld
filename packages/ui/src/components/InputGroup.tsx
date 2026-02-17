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

import type {PropsWithChildren, ReactNode} from 'hono/jsx';

export type InputGroupGap = 'small' | 'medium' | 'large';

export interface InputGroupProps {
	children: ReactNode;
	gap?: InputGroupGap;
	direction?: 'vertical' | 'horizontal';
	align?: 'start' | 'center' | 'end' | 'stretch';
	class?: string;
}

const gapClasses: Record<InputGroupGap, string> = {
	small: 'gap-3',
	medium: 'gap-4',
	large: 'gap-6',
};

const directionClasses: Record<'vertical' | 'horizontal', string> = {
	vertical: 'flex-col',
	horizontal: 'flex-row',
};

const alignClasses: Record<'start' | 'center' | 'end' | 'stretch', string> = {
	start: 'items-start',
	center: 'items-center',
	end: 'items-end',
	stretch: 'items-stretch',
};

export function InputGroup({
	children,
	gap = 'medium',
	direction = 'vertical',
	align = 'stretch',
	class: className,
}: PropsWithChildren<InputGroupProps>) {
	return (
		<div class={`flex ${directionClasses[direction]} ${gapClasses[gap]} ${alignClasses[align]} ${className ?? ''}`}>
			{children}
		</div>
	);
}
