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

export interface BadgeProps {
	variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
	size?: 'sm' | 'md';
}

export function Badge({variant = 'neutral', size = 'md', children}: PropsWithChildren<BadgeProps>) {
	const classes = clsx(
		'inline-flex items-center justify-center rounded-full font-medium',
		{
			'px-2 py-0.5 text-xs': size === 'sm',
			'px-2.5 py-1 text-sm': size === 'md',
		},
		{
			'bg-green-100 text-green-600': variant === 'success',
			'bg-red-100 text-red-600': variant === 'danger',
			'bg-neutral-100 text-neutral-700 border border-neutral-200': variant === 'warning',
			'bg-blue-100 text-blue-600': variant === 'info',
			'bg-neutral-100 text-neutral-600': variant === 'neutral',
		},
	);

	return <span class={classes}>{children}</span>;
}
