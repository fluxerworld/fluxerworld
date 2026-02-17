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

import type {ChildrenProps, TextProps} from '@fluxer/ui/src/types/Common';
import type {PropsWithChildren} from 'hono/jsx';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type CardVariant = 'default' | 'elevated' | 'empty' | 'marketing';
export type CardShadow = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardProps {
	variant?: CardVariant;
	padding?: CardPadding;
	hoverable?: boolean;
	centerContent?: boolean;
	heading?: string;
	description?: string;
	shadow?: CardShadow;
	border?: boolean;
	class?: string;
	id?: string;
}

const cardPaddingClasses: Record<CardPadding, string> = {
	none: 'p-0',
	sm: 'p-4',
	md: 'p-6',
	lg: 'p-8',
	xl: 'p-12',
};

const cardShadowClasses: Record<CardShadow, string> = {
	none: '',
	sm: 'shadow-sm',
	md: 'shadow-md',
	lg: 'shadow-lg',
	xl: 'shadow-xl',
};

export function Card({
	variant = 'default',
	padding = 'md',
	hoverable = false,
	centerContent = false,
	heading,
	description,
	shadow,
	border = true,
	class: extraClass,
	id,
	children,
}: PropsWithChildren<CardProps>) {
	const baseClasses = ['rounded-lg', 'bg-white', 'transition-all'];

	const variantClasses: Record<CardVariant, string> = {
		default: border ? 'border border-neutral-200' : '',
		elevated: border ? 'border border-neutral-200' : '',
		empty: border ? 'border border-neutral-200' : '',
		marketing: 'border-2 border-white/20 bg-white/5 backdrop-blur-sm',
	};

	const shadowValue = shadow !== undefined ? shadow : variant === 'elevated' ? 'sm' : 'none';
	const shadowClass = cardShadowClasses[shadowValue];

	const stateClasses = [
		hoverable ? 'hover:shadow-lg hover:-translate-y-1 cursor-pointer' : '',
		centerContent ? 'text-center' : '',
	].filter(Boolean);

	const classes = [
		...baseClasses,
		variantClasses[variant],
		shadowClass,
		cardPaddingClasses[padding],
		...stateClasses,
		extraClass || '',
	]
		.filter(Boolean)
		.join(' ');

	const content = (
		<>
			{heading && (
				<div class="mb-4 space-y-1">
					<h3 class="font-medium text-lg text-neutral-900">{heading}</h3>
					{description && <p class="text-neutral-500 text-sm">{description}</p>}
				</div>
			)}
			{children}
		</>
	);

	return (
		<div class={classes} id={id}>
			{content}
		</div>
	);
}

export function CardElevated({padding = 'md', children, ...props}: PropsWithChildren<CardProps>) {
	return (
		<Card variant="elevated" padding={padding} {...props}>
			{children}
		</Card>
	);
}

export function CardEmpty({children}: ChildrenProps) {
	return (
		<Card variant="empty" centerContent padding="xl">
			{children}
		</Card>
	);
}

export interface HeadingCardProps extends Omit<CardProps, 'heading'>, TextProps {
	description?: string;
}

export function HeadingCard({
	text,
	description,
	padding = 'md',
	children,
	...props
}: PropsWithChildren<HeadingCardProps>) {
	return (
		<Card heading={text} description={description} padding={padding} {...props}>
			{children}
		</Card>
	);
}
