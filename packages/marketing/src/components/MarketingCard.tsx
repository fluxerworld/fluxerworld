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

import type {PropsWithChildren} from 'hono/jsx';

type MarketingCardTheme = 'light' | 'dark';
type MarketingCardPadding = 'sm' | 'md' | 'lg';

interface MarketingCardProps {
	theme?: MarketingCardTheme;
	padding?: MarketingCardPadding;
	class?: string;
	style?: string;
	children: JSX.Element | Array<JSX.Element> | string;
}

const marketingCardPaddingClasses: Record<MarketingCardPadding, string> = {
	sm: 'p-6 md:p-8',
	md: 'p-8 md:p-10',
	lg: 'p-10 md:p-12',
};

export function MarketingCard({
	theme = 'light',
	padding = 'md',
	class: className = '',
	style,
	children,
}: PropsWithChildren<MarketingCardProps>): JSX.Element {
	const paddingClass = marketingCardPaddingClasses[padding];
	const themeClasses =
		theme === 'dark' ? 'border-white/20 bg-white/10 shadow-lg backdrop-blur-sm' : 'border-gray-200 bg-white shadow-md';
	const baseClasses = 'flex h-full flex-col rounded-3xl border';

	const combinedClasses = `${baseClasses} ${themeClasses} ${paddingClass} ${className}`.trim();

	return (
		<div class={combinedClasses} style={style}>
			{children}
		</div>
	);
}
