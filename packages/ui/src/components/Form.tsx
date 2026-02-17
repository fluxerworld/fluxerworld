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

import {
	FORM_CONTROL_INPUT_CLASS,
	FORM_CONTROL_SELECT_CLASS,
	FORM_CONTROL_TEXTAREA_CLASS,
	FORM_FIELD_CLASS,
	FORM_HELPER_CLASS,
	FORM_LABEL_CLASS,
	FORM_SELECT_ICON_CLASS,
} from '@fluxer/ui/src/styles/FormControls';
import type {BaseFormProps, SelectOption} from '@fluxer/ui/src/types/Common';
import {cn} from '@fluxer/ui/src/utils/ClassNames';

export type InputType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' | 'url';

function toInputId(name: string): string {
	return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function toHelperId(id: string, helper: string | undefined): string | undefined {
	if (!helper) {
		return undefined;
	}
	return `${id}-helper`;
}

export interface InputProps extends BaseFormProps {
	type?: InputType;
	value?: string | undefined;
	autocomplete?: string;
	step?: string;
	min?: string | number;
	max?: string | number;
	readonly?: boolean;
}

export function Input({
	label,
	helper,
	name,
	id,
	type = 'text',
	value,
	required,
	placeholder,
	disabled,
	autocomplete,
	step,
	min,
	max,
	readonly,
}: InputProps) {
	const inputId = id ?? toInputId(name);
	const helperId = toHelperId(inputId, helper);

	return (
		<div class={FORM_FIELD_CLASS}>
			{label && (
				<label for={inputId} class={FORM_LABEL_CLASS}>
					{label}
				</label>
			)}
			<input
				id={inputId}
				type={type}
				name={name}
				value={value}
				required={required}
				placeholder={placeholder}
				disabled={disabled}
				readonly={readonly}
				autocomplete={autocomplete}
				step={step}
				min={min}
				max={max}
				aria-describedby={helperId}
				class={FORM_CONTROL_INPUT_CLASS}
			/>
			{helper && (
				<p id={helperId} class={FORM_HELPER_CLASS}>
					{helper}
				</p>
			)}
		</div>
	);
}

export interface TextareaProps extends BaseFormProps {
	value?: string;
	rows?: number;
}

export function Textarea({label, helper, name, id, value, required, placeholder, disabled, rows = 4}: TextareaProps) {
	const textareaId = id ?? toInputId(name);
	const helperId = toHelperId(textareaId, helper);

	return (
		<div class={FORM_FIELD_CLASS}>
			{label && (
				<label for={textareaId} class={FORM_LABEL_CLASS}>
					{label}
				</label>
			)}
			<textarea
				id={textareaId}
				name={name}
				rows={rows}
				required={required}
				placeholder={placeholder}
				disabled={disabled}
				aria-describedby={helperId}
				class={FORM_CONTROL_TEXTAREA_CLASS}
			>
				{value}
			</textarea>
			{helper && (
				<p id={helperId} class={FORM_HELPER_CLASS}>
					{helper}
				</p>
			)}
		</div>
	);
}

export interface SelectProps extends BaseFormProps {
	value?: string;
	options: Array<SelectOption>;
}

export function Select({label, helper, name, id, value, required, disabled, options}: SelectProps) {
	const selectId = id ?? toInputId(name);
	const helperId = toHelperId(selectId, helper);

	return (
		<div class={FORM_FIELD_CLASS}>
			{label && (
				<label for={selectId} class={FORM_LABEL_CLASS}>
					{label}
				</label>
			)}
			<div class="relative">
				<select
					id={selectId}
					name={name}
					required={required}
					disabled={disabled}
					aria-describedby={helperId}
					class={FORM_CONTROL_SELECT_CLASS}
				>
					{options.map((option) => (
						<option key={option.value} value={option.value} selected={option.value === value}>
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
			{helper && (
				<p id={helperId} class={FORM_HELPER_CLASS}>
					{helper}
				</p>
			)}
		</div>
	);
}

export interface CheckboxProps {
	name: string;
	value: string;
	label: string;
	checked?: boolean;
	onChange?: string;
}

export function Checkbox({name, value, label, checked, onChange}: CheckboxProps) {
	return (
		<label class="group flex w-full cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				name={name}
				value={value}
				checked={checked}
				class="hidden"
				{...(onChange ? {onchange: onChange} : {})}
			/>
			<div class="checkbox-custom flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 256 256"
					class="h-[18px] w-[18px]"
					style="stroke-width: 32;"
				>
					<polyline
						points="40 144 96 200 224 72"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
			<div class="min-w-0 flex-1">
				<span class={cn('block text-neutral-900 text-sm', 'leading-5')}>{label}</span>
			</div>
		</label>
	);
}
