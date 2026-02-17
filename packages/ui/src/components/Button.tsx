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

import {createCompoundVariantClasses} from '@fluxer/ui/src/utils/VariantClasses';
import type {Child, FC, PropsWithChildren} from 'hono/jsx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'info' | 'ghost' | 'brand';
export type ButtonSize = 'small' | 'medium' | 'large' | 'xl';
export type ButtonIconPosition = 'left' | 'right';

const {getVariant: getVariantClasses, getSize: getSizeClasses} = createCompoundVariantClasses(
	{
		primary: 'bg-neutral-900 text-white hover:bg-neutral-800',
		secondary:
			'bg-neutral-50 text-neutral-700 hover:text-neutral-900 border border-neutral-300 hover:border-neutral-400',
		danger: 'bg-red-600 text-white hover:bg-red-700',
		success: 'bg-blue-600 text-white hover:bg-blue-700',
		info: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
		ghost: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
		brand: 'bg-brand-primary text-white shadow-sm hover:bg-[color-mix(in_srgb,var(--brand-primary)_80%,black)]',
	},
	{
		small: 'px-3 py-1.5 text-sm',
		medium: 'px-4 py-2 text-base',
		large: 'px-6 py-3 text-lg',
		xl: 'px-8 py-4 text-xl',
	},
	'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2',
);

export interface ButtonProps {
	type?: 'button' | 'submit' | 'reset';
	variant?: ButtonVariant;
	size?: ButtonSize;
	fullWidth?: boolean;
	name?: string;
	value?: string;
	disabled?: boolean;
	loading?: boolean;
	href?: string;
	icon?: Child;
	iconPosition?: ButtonIconPosition;
	onclick?: string;
	class?: string;
	target?: '_blank' | '_self' | '_parent' | '_top';
	rel?: string;
	id?: string;
	ariaLabel?: string;
}

export const Button: FC<PropsWithChildren<ButtonProps>> = ({
	type = 'button',
	variant = 'primary',
	size = 'medium',
	fullWidth = false,
	name,
	value,
	disabled = false,
	loading = false,
	href,
	icon,
	iconPosition = 'left',
	onclick,
	class: extraClass,
	target,
	rel,
	id,
	ariaLabel,
	children,
}) => {
	const baseClasses = getVariantClasses(variant);
	const sizeClasses = getSizeClasses(size);

	const stateClasses = [
		fullWidth ? 'w-full sm:w-fit' : 'w-fit',
		disabled || loading ? 'opacity-50 cursor-not-allowed' : '',
		loading ? 'pointer-events-none' : '',
		variant === 'primary' || variant === 'danger' || variant === 'success' || variant === 'brand'
			? 'focus:ring-offset-white'
			: '',
	].filter(Boolean);

	const classes = [baseClasses, sizeClasses, ...stateClasses, extraClass || ''].filter(Boolean).join(' ');

	const iconElement = icon ? <span class="flex-shrink-0">{icon}</span> : null;

	const content = (
		<>
			{icon && iconPosition === 'left' && iconElement}
			{loading && <span class="mr-2 inline-block animate-spin">⏳</span>}
			<span>{children}</span>
			{icon && iconPosition === 'right' && iconElement}
		</>
	);

	const commonProps = {
		class: classes,
		id,
		'aria-label': ariaLabel,
	};

	if (href) {
		return (
			<a
				{...commonProps}
				href={href}
				target={target}
				rel={rel || (target === '_blank' ? 'noopener noreferrer' : undefined)}
				role="button"
			>
				{content}
			</a>
		);
	}

	return (
		<button {...commonProps} type={type} name={name} value={value} disabled={disabled || loading} onclick={onclick}>
			{content}
		</button>
	);
};
