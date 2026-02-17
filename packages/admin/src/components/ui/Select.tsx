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

import type {FC} from 'hono/jsx';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectProps {
	name: string;
	id?: string;
	value?: string;
	options: Array<SelectOption>;
	placeholder?: string;
	disabled?: boolean;
	required?: boolean;
	size?: SelectSize;
	error?: boolean;
	fullWidth?: boolean;
	class?: string;
}

const sizeClasses: Record<SelectSize, string> = {
	sm: 'h-8 px-3 py-1.5 text-sm',
	md: 'h-9 px-3 py-2 text-sm',
	lg: 'h-10 px-4 py-2.5 text-base',
};

export const Select: FC<SelectProps> = ({
	name,
	id,
	value,
	options,
	placeholder,
	disabled = false,
	required = false,
	size = 'sm',
	error = false,
	fullWidth = true,
	class: extraClass,
}) => {
	const baseClasses = [
		'rounded-lg',
		'border',
		'border-neutral-300',
		'bg-white',
		'text-neutral-900',
		'transition-all',
		'focus:outline-none',
		'focus:border-brand-primary',
		'focus:ring-2',
		'focus:ring-brand-primary/20',
		'disabled:opacity-50',
		'disabled:cursor-not-allowed',
		'disabled:bg-neutral-50',
		'appearance-none',
		"bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")]",
		'bg-[length:1.1em_1.1em]',
		'bg-[position:right_0.75rem_center]',
		'bg-no-repeat',
		'pr-10',
	];

	const stateClasses = [
		error ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : '',
		fullWidth ? 'w-full' : '',
	].filter(Boolean);

	const classes = [...baseClasses, sizeClasses[size], ...stateClasses, extraClass || ''].filter(Boolean).join(' ');

	return (
		<select name={name} id={id} disabled={disabled} required={required} class={classes}>
			{placeholder && (
				<option value="" disabled selected={!value}>
					{placeholder}
				</option>
			)}
			{options.map((option) => (
				<option value={option.value} selected={option.value === value} disabled={option.disabled}>
					{option.label}
				</option>
			))}
		</select>
	);
};
