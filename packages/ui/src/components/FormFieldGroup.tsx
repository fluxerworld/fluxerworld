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

import type {PropsWithChildren, ReactNode} from 'hono/jsx';

export interface FormFieldGroupProps {
	label: string;
	helperText?: string;
	error?: string;
	required?: boolean;
	children: ReactNode;
	id?: string;
}

export function FormFieldGroup({
	label,
	helperText,
	error,
	required = false,
	children,
	id,
}: PropsWithChildren<FormFieldGroupProps>) {
	const fieldId = id || label.toLowerCase().replace(/\s+/g, '-');
	const helperId = `${fieldId}-helper`;
	const errorId = `${fieldId}-error`;

	const labelClass = error ? 'text-red-700 font-medium' : 'text-neutral-700 font-medium';

	const helperClass = error ? 'text-red-600' : 'text-neutral-500';

	return (
		<div class="space-y-1.5">
			<label for={fieldId} class={`block text-sm ${labelClass}`}>
				{label}
				{required && <span class="ml-1 text-red-600">*</span>}
			</label>

			{children}

			{helperText && !error && (
				<p id={helperId} class={`text-xs ${helperClass}`}>
					{helperText}
				</p>
			)}

			{error && (
				<p id={errorId} class="font-medium text-red-600 text-xs">
					{error}
				</p>
			)}
		</div>
	);
}
