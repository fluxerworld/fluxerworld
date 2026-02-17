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

import type {Child, FC} from 'hono/jsx';

export type InputSize = 'sm' | 'md' | 'lg';
export type InputType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' | 'datetime-local' | 'url' | 'search';

export interface InputProps {
	type?: InputType;
	name: string;
	id?: string;
	value?: string;
	placeholder?: string;
	disabled?: boolean;
	required?: boolean;
	readonly?: boolean;
	size?: InputSize;
	error?: boolean;
	fullWidth?: boolean;
	leftIcon?: Child;
	rightIcon?: Child;
	autocomplete?: string;
	min?: string | number;
	max?: string | number;
	step?: string | number;
	pattern?: string;
	class?: string;
}

const sizeClasses: Record<InputSize, string> = {
	sm: 'h-8 px-3 py-1.5 text-sm',
	md: 'h-9 px-3 py-2 text-sm',
	lg: 'h-10 px-4 py-2.5 text-base',
};

function toInputId(name: string): string {
	return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export const Input: FC<InputProps> = ({
	type = 'text',
	name,
	id,
	value,
	placeholder,
	disabled = false,
	required = false,
	readonly = false,
	size = 'sm',
	error = false,
	fullWidth = true,
	leftIcon,
	rightIcon,
	autocomplete,
	min,
	max,
	step,
	pattern,
	class: extraClass,
}) => {
	const inputId = id ?? toInputId(name);
	const baseClasses = [
		'rounded-lg',
		'border',
		'border-neutral-300',
		'bg-white',
		'text-neutral-900',
		'placeholder:text-neutral-400',
		'transition-all',
		'focus:outline-none',
		'focus:ring-2',
		'disabled:opacity-50',
		'disabled:cursor-not-allowed',
		'disabled:bg-neutral-50',
	];

	const stateClasses = [
		error
			? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
			: 'focus:border-brand-primary focus:ring-brand-primary/20',
		fullWidth ? 'w-full' : '',
		leftIcon ? 'pl-10' : '',
		rightIcon ? 'pr-10' : '',
	].filter(Boolean);

	const classes = [...baseClasses, sizeClasses[size], ...stateClasses, extraClass || ''].filter(Boolean).join(' ');

	if (leftIcon || rightIcon) {
		return (
			<div class={`relative ${fullWidth ? 'w-full' : 'inline-flex'}`}>
				{leftIcon && (
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
						{leftIcon}
					</div>
				)}
				<input
					type={type}
					name={name}
					id={inputId}
					value={value}
					placeholder={placeholder}
					disabled={disabled}
					required={required}
					readonly={readonly}
					autocomplete={autocomplete}
					min={min}
					max={max}
					step={step}
					pattern={pattern}
					class={classes}
				/>
				{rightIcon && (
					<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400">
						{rightIcon}
					</div>
				)}
			</div>
		);
	}

	return (
		<input
			type={type}
			name={name}
			id={inputId}
			value={value}
			placeholder={placeholder}
			disabled={disabled}
			required={required}
			readonly={readonly}
			autocomplete={autocomplete}
			min={min}
			max={max}
			step={step}
			pattern={pattern}
			class={classes}
		/>
	);
};
