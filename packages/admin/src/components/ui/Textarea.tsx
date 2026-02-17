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

export type TextareaSize = 'sm' | 'md' | 'lg';
export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both';

export interface TextareaProps {
	name: string;
	id?: string;
	value?: string;
	placeholder?: string;
	disabled?: boolean;
	required?: boolean;
	readonly?: boolean;
	rows?: number;
	size?: TextareaSize;
	error?: boolean;
	fullWidth?: boolean;
	maxlength?: number;
	minlength?: number;
	resize?: TextareaResize;
	class?: string;
}

const sizeClasses: Record<TextareaSize, string> = {
	sm: 'px-3 py-1.5 text-sm',
	md: 'px-3 py-2 text-sm',
	lg: 'px-4 py-3 text-base',
};

const resizeClasses: Record<TextareaResize, string> = {
	none: 'resize-none',
	vertical: 'resize-y',
	horizontal: 'resize-x',
	both: 'resize',
};

function toTextareaId(name: string): string {
	return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export const Textarea: FC<TextareaProps> = ({
	name,
	id,
	value,
	placeholder,
	disabled = false,
	required = false,
	readonly = false,
	rows = 4,
	size = 'sm',
	error = false,
	fullWidth = true,
	maxlength,
	minlength,
	resize = 'vertical',
	class: extraClass,
}) => {
	const textareaId = id ?? toTextareaId(name);
	const baseClasses = [
		'rounded-lg',
		'border',
		'bg-white',
		'text-neutral-900',
		'placeholder:text-neutral-400',
		'transition-all',
		'focus:outline-none',
		'focus:ring-2',
		'focus:ring-brand-primary/20',
		'disabled:opacity-50',
		'disabled:cursor-not-allowed',
		'disabled:bg-neutral-50',
	];

	const stateClasses = [
		error ? 'border-red-500 focus:border-red-500' : 'border-neutral-300 focus:border-brand-primary',
		fullWidth ? 'w-full' : '',
	].filter(Boolean);

	const classes = [...baseClasses, sizeClasses[size], resizeClasses[resize], ...stateClasses, extraClass || '']
		.filter(Boolean)
		.join(' ');

	return (
		<textarea
			name={name}
			id={textareaId}
			placeholder={placeholder}
			disabled={disabled}
			required={required}
			readonly={readonly}
			rows={rows}
			maxlength={maxlength}
			minlength={minlength}
			class={classes}
		>
			{value}
		</textarea>
	);
};
