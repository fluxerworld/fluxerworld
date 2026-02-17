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

export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type CardVariant = 'default' | 'bordered' | 'elevated';

export interface CardProps {
	padding?: CardPadding;
	variant?: CardVariant;
	className?: string;
}

const paddingClasses: Record<CardPadding, string> = {
	none: 'p-0',
	sm: 'p-4',
	md: 'p-6',
	lg: 'p-8',
	xl: 'p-12',
};

const variantClasses: Record<CardVariant, string> = {
	default: 'border border-neutral-200',
	bordered: 'border-2 border-neutral-300',
	elevated: 'border border-neutral-200 shadow-md',
};

export function Card({padding = 'md', variant = 'default', className, children}: PropsWithChildren<CardProps>) {
	const classes = clsx('rounded-lg bg-white', variantClasses[variant], paddingClasses[padding], className);

	return <div class={classes}>{children}</div>;
}
