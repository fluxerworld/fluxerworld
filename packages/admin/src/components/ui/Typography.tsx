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
import type {Child, PropsWithChildren} from 'hono/jsx';

export interface HeadingProps {
	level: 1 | 2 | 3 | 4 | 5 | 6;
	size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
	class?: string;
}

const headingSizes: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
	1: 'text-3xl font-bold',
	2: 'text-2xl font-semibold',
	3: 'text-xl font-semibold',
	4: 'text-lg font-semibold',
	5: 'text-base font-semibold',
	6: 'text-sm font-semibold',
};

const customSizes: Record<NonNullable<HeadingProps['size']>, string> = {
	xs: 'text-xs',
	sm: 'text-sm',
	base: 'text-base',
	lg: 'text-lg',
	xl: 'text-xl',
	'2xl': 'text-2xl',
	'3xl': 'text-3xl',
	'4xl': 'text-4xl',
};

export function Heading(props: PropsWithChildren<HeadingProps>) {
	const {level, size, children, class: className} = props;

	const classes = cn('text-gray-900 tracking-tight', size ? customSizes[size] : headingSizes[level], className);

	if (level === 1) return <h1 class={classes}>{children}</h1>;
	if (level === 2) return <h2 class={classes}>{children}</h2>;
	if (level === 3) return <h3 class={classes}>{children}</h3>;
	if (level === 4) return <h4 class={classes}>{children}</h4>;
	if (level === 5) return <h5 class={classes}>{children}</h5>;
	return <h6 class={classes}>{children}</h6>;
}

export interface TextProps {
	size?: 'xs' | 'sm' | 'base' | 'lg';
	weight?: 'normal' | 'medium' | 'semibold' | 'bold';
	color?: 'default' | 'muted' | 'primary' | 'danger' | 'success';
	class?: string;
}

const textSizes: Record<NonNullable<TextProps['size']>, string> = {
	xs: 'text-xs',
	sm: 'text-sm',
	base: 'text-base',
	lg: 'text-lg',
};

const textWeights: Record<NonNullable<TextProps['weight']>, string> = {
	normal: 'font-normal',
	medium: 'font-medium',
	semibold: 'font-semibold',
	bold: 'font-bold',
};

const textColors: Record<NonNullable<TextProps['color']>, string> = {
	default: 'text-gray-900',
	muted: 'text-neutral-500',
	primary: 'text-brand-primary',
	danger: 'text-red-600',
	success: 'text-green-600',
};

export function Text(props: PropsWithChildren<TextProps>) {
	const {size = 'base', weight = 'normal', color = 'default', children, class: className} = props;

	const classes = cn(textSizes[size], textWeights[weight], textColors[color], className);

	return <p class={classes}>{children}</p>;
}

export interface LabelProps {
	htmlFor?: string;
	required?: boolean;
	class?: string;
}

export function Label(props: PropsWithChildren<LabelProps>) {
	const {htmlFor, required = false, children, class: className} = props;

	const classes = cn('block text-xs font-semibold uppercase tracking-wide text-neutral-500', className);

	return (
		<label for={htmlFor} class={classes}>
			{children}
			{required && <span class="ml-1 text-red-600">*</span>}
		</label>
	);
}

export interface CaptionProps {
	variant?: 'default' | 'error' | 'success';
	class?: string;
}

const captionVariants: Record<NonNullable<CaptionProps['variant']>, string> = {
	default: 'text-gray-500',
	error: 'text-red-600',
	success: 'text-green-600',
};

export function Caption(props: PropsWithChildren<CaptionProps>) {
	const {variant = 'default', children, class: className} = props;

	const classes = cn('text-xs', captionVariants[variant], className);

	return <p class={classes}>{children}</p>;
}

export interface SectionHeadingProps {
	actions?: Child;
	class?: string;
}

export function SectionHeading(props: PropsWithChildren<SectionHeadingProps>) {
	const {actions, children, class: className} = props;

	if (actions) {
		return (
			<div class={cn('mb-4 flex items-center justify-between', className)}>
				<h2 class="font-semibold text-gray-900 text-xl">{children}</h2>
				<div class="flex items-center gap-2">{actions}</div>
			</div>
		);
	}

	return <h2 class={cn('mb-4 font-semibold text-gray-900 text-xl', className)}>{children}</h2>;
}
