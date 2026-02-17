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

import {GRADIENTS} from '@fluxer/ui/src/styles/Gradients';

const GRADIENT_MAP = {
	cta: GRADIENTS.cta,
	dark: GRADIENTS.purple,
	light: GRADIENTS.light,
	white: 'bg-white',
} as const;

export type SectionVariant = keyof typeof GRADIENT_MAP;

interface SectionProps {
	variant?: SectionVariant;
	title?: string;
	description?: string;
	children: JSX.Element | Array<JSX.Element> | string;
	className?: string;
	id?: string;
}

export function Section(props: SectionProps): JSX.Element {
	const {variant = 'dark', title, description, children, className = '', id = undefined} = props;

	const gradientClass = GRADIENT_MAP[variant];
	const isDark = variant === 'dark' || variant === 'cta';
	const textColorClass = isDark ? 'text-white' : 'text-black';
	const descriptionColorClass = isDark ? 'text-white/90' : 'text-gray-700';

	return (
		<section id={id} class={`${gradientClass} px-6 py-16 sm:px-8 md:px-12 md:py-24 lg:px-16 xl:px-20 ${className}`}>
			<div class="mx-auto max-w-7xl">
				{title && description && (
					<div class="mb-12 text-center md:mb-16">
						<h2 class={`display mb-6 text-4xl md:mb-8 md:text-5xl lg:text-6xl ${textColorClass}`}>{title}</h2>
						<p class={`lead mx-auto max-w-3xl ${descriptionColorClass}`}>{description}</p>
					</div>
				)}
				{children}
			</div>
		</section>
	);
}
