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

import {Caption, Label} from '@fluxer/admin/src/components/ui/Typography';
import {cn} from '@fluxer/admin/src/utils/ClassNames';
import type {Child} from 'hono/jsx';

export interface FormFieldGroupProps {
	label: string;
	htmlFor?: string;
	required?: boolean;
	error?: string;
	helper?: Child;
	children: Child;
	class?: string;
}

export function FormFieldGroup(props: FormFieldGroupProps) {
	const {label, htmlFor, required = false, error, helper, children, class: className} = props;
	const helperView =
		!error && helper !== undefined && helper !== null ? (
			typeof helper === 'string' || typeof helper === 'number' ? (
				<Caption>{helper}</Caption>
			) : (
				helper
			)
		) : null;

	return (
		<div class={cn('flex flex-col gap-2', className)}>
			<div class="flex flex-col gap-1">
				<Label htmlFor={htmlFor} required={required}>
					{label}
				</Label>
				{helperView}
			</div>
			<div class="flex flex-col gap-1">
				{children}
				{error && (
					<p class="flex items-center gap-1 text-red-600 text-sm">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							class="h-4 w-4 flex-shrink-0"
						>
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
								clip-rule="evenodd"
							/>
						</svg>
						{error}
					</p>
				)}
			</div>
		</div>
	);
}
