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

import type {ButtonProps} from '@fluxer/ui/src/components/Button';
import type {Child, PropsWithChildren} from 'hono/jsx';

type MarketingButtonSize = 'small' | 'medium' | 'large' | 'xl';

interface MarketingButtonProps extends Omit<ButtonProps, 'size' | 'variant' | 'target'> {
	size?: MarketingButtonSize;
	href?: string;
	target?: '_blank' | '_self' | '_parent' | '_top';
	rel?: string;
	children?: Child;
}

const marketingButtonSizeClasses: Record<MarketingButtonSize, string> = {
	small: 'px-4 py-2 text-sm',
	medium: 'px-6 py-3 text-base',
	large: 'px-8 py-4 text-lg',
	xl: 'px-10 py-5 text-xl',
};

export function MarketingButton({
	size = 'large',
	href,
	target,
	rel,
	children,
	class: className = '',
	...props
}: PropsWithChildren<MarketingButtonProps>): JSX.Element {
	const sizeClass = marketingButtonSizeClasses[size];
	const marketingClasses =
		`rounded-xl bg-[#4641D9] font-semibold text-white shadow-lg transition hover:bg-[#3832B8] ${sizeClass} ${className}`.trim();

	if (href) {
		return (
			<a href={href} class={marketingClasses} target={target} rel={rel}>
				{children}
			</a>
		);
	}

	return (
		<button {...props} class={marketingClasses}>
			{children}
		</button>
	);
}

export function MarketingButtonSecondary({
	size = 'large',
	href,
	target,
	rel,
	children,
	class: className = '',
}: PropsWithChildren<MarketingButtonProps>): JSX.Element {
	const sizeClass = marketingButtonSizeClasses[size];
	const combinedClasses =
		`inline-flex items-center gap-2 rounded-xl border-2 border-[#4641D9] font-semibold text-[#4641D9] shadow-lg transition hover:bg-[#4641D9]/10 ${sizeClass} ${className}`.trim();

	return (
		<a href={href} class={combinedClasses} target={target} rel={rel}>
			{children}
		</a>
	);
}

export function MarketingButtonInverted({
	size = 'large',
	href,
	target,
	rel,
	children,
	class: className = '',
}: PropsWithChildren<MarketingButtonProps>): JSX.Element {
	const sizeClass = marketingButtonSizeClasses[size];
	const combinedClasses =
		`inline-flex items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-[#4641D9] shadow-lg transition hover:bg-white/90 ${sizeClass} ${className}`.trim();

	return (
		<a href={href} class={combinedClasses} target={target} rel={rel}>
			{children}
		</a>
	);
}
