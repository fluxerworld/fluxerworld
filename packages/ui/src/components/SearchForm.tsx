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

import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {
	FORM_CONTROL_INPUT_CLASS,
	FORM_CONTROL_SELECT_CLASS,
	FORM_SELECT_ICON_CLASS,
} from '@fluxer/ui/src/styles/FormControls';
import {cn} from '@fluxer/ui/src/utils/ClassNames';
import type {FC} from 'hono/jsx';

export type SearchFieldType = 'text' | 'select' | 'number';

export interface SearchFieldOption {
	value: string;
	label: string;
}

export interface SearchField {
	name: string;
	type: SearchFieldType;
	label?: string;
	placeholder?: string;
	value?: string | number | undefined;
	options?: Array<SearchFieldOption>;
	autocomplete?: string;
}

export interface SearchFormProps {
	action: string;
	method?: 'get' | 'post';
	fields: Array<SearchField>;
	submitLabel?: string;
	showClear?: boolean;
	clearHref?: string;
	clearLabel?: string;
	helperText?: string;
	layout?: 'vertical' | 'horizontal';
	padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
	basePath?: string;
}

function withBasePath(basePath: string, path: string): string {
	return `${basePath}${path}`;
}

function getSearchInputClass(): string {
	return cn(FORM_CONTROL_INPUT_CLASS, 'h-10');
}

function getSearchSelectClass(): string {
	return cn(FORM_CONTROL_SELECT_CLASS, 'h-10');
}

export const SearchForm: FC<SearchFormProps> = ({
	action,
	method = 'get',
	fields,
	submitLabel = 'Search',
	showClear = true,
	clearHref,
	clearLabel = 'Clear',
	helperText,
	layout = 'vertical',
	padding = 'sm',
	basePath = '',
}) => {
	const isHorizontal = layout === 'horizontal';
	const actionUrl = withBasePath(basePath, action);
	const formClass = isHorizontal ? 'flex flex-col gap-3 sm:flex-row sm:items-center' : 'space-y-4';
	const fieldGroupClass = isHorizontal ? 'flex flex-1 flex-col gap-2 sm:flex-row' : 'space-y-4';
	const actionGroupClass = isHorizontal ? 'flex flex-col gap-2 sm:shrink-0 sm:flex-row' : 'flex flex-wrap gap-2';
	const clearUrl = clearHref ? withBasePath(basePath, clearHref) : undefined;

	return (
		<Card padding={padding}>
			<form method={method} action={actionUrl} class={formClass}>
				<div class={fieldGroupClass}>
					{fields.map((field) => (
						<SearchFieldInput key={field.name} field={field} layout={layout} />
					))}
				</div>
				<div class={actionGroupClass}>
					<Button type="submit" variant="primary" fullWidth={isHorizontal}>
						{submitLabel}
					</Button>
					{showClear && clearUrl && (
						<Button type="button" href={clearUrl} variant="secondary" fullWidth={isHorizontal} ariaLabel={clearLabel}>
							{clearLabel}
						</Button>
					)}
				</div>
				{helperText && <p class={cn('text-neutral-500 text-xs', isHorizontal && 'sm:pt-1')}>{helperText}</p>}
			</form>
		</Card>
	);
};

interface SearchFieldInputProps {
	field: SearchField;
	layout: 'vertical' | 'horizontal';
}

function SearchFieldInput({field, layout}: SearchFieldInputProps) {
	const controlId = `search-${field.name}`;
	const isVertical = layout === 'vertical';
	const containerClass = isVertical ? 'w-full' : 'flex-1';
	const labelClass = 'mb-2 block font-medium text-neutral-700 text-sm';

	if (field.type === 'select') {
		return (
			<div class={containerClass}>
				{isVertical && field.label && (
					<label for={controlId} class={labelClass}>
						{field.label}
					</label>
				)}
				<div class="relative">
					<select id={controlId} name={field.name} class={getSearchSelectClass()} autocomplete={field.autocomplete}>
						{field.options?.map((option) => (
							<option key={option.value} value={option.value} selected={String(field.value) === option.value}>
								{option.label}
							</option>
						))}
					</select>
					<svg class={FORM_SELECT_ICON_CLASS} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
						<path
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="m6 8 4 4 4-4"
						/>
					</svg>
				</div>
			</div>
		);
	}

	return (
		<div class={containerClass}>
			{isVertical && field.label && (
				<label for={controlId} class={labelClass}>
					{field.label}
				</label>
			)}
			<input
				id={controlId}
				type={field.type}
				name={field.name}
				value={field.value ?? ''}
				placeholder={field.placeholder}
				class={getSearchInputClass()}
				autocomplete={field.autocomplete}
			/>
		</div>
	);
}
