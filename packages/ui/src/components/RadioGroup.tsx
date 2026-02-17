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

export type RadioGroupOrientation = 'vertical' | 'horizontal';

export interface RadioOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface RadioGroupProps {
	name: string;
	label?: string;
	value: string;
	options: Array<RadioOption>;
	orientation?: RadioGroupOrientation;
	disabled?: boolean;
	helperText?: string;
	error?: string;
	onChangeScript?: string;
}

const orientationClasses: Record<RadioGroupOrientation, string> = {
	vertical: 'flex-col gap-3',
	horizontal: 'flex-row gap-6',
};

export function RadioGroup({
	name,
	label,
	value,
	options,
	orientation = 'vertical',
	disabled = false,
	helperText,
	error,
	onChangeScript,
}: RadioGroupProps) {
	const groupId = `${name}-group`;

	return (
		<div class="space-y-1.5">
			{label && <span class="block font-medium text-neutral-700 text-sm">{label}</span>}

			<div id={groupId} class={`flex ${orientationClasses[orientation]}`}>
				{options.map((option) => {
					const optionId = `${name}-${option.value}`;
					const isOptionDisabled = disabled || option.disabled;

					return (
						<label
							key={option.value}
							for={optionId}
							class={`flex cursor-pointer items-center gap-2 ${
								isOptionDisabled ? 'cursor-not-allowed opacity-50' : ''
							}`}
						>
							<div class="relative">
								<input
									type="radio"
									id={optionId}
									name={name}
									value={option.value}
									checked={value === option.value}
									disabled={isOptionDisabled}
									class="sr-only"
									onchange={onChangeScript}
								/>
								<div
									class={`h-4 w-4 rounded-full border-2 transition-colors ${
										value === option.value ? 'border-neutral-900' : 'border-neutral-300'
									}`}
								>
									{value === option.value && <div class="mt-0.5 ml-0.5 h-2 w-2 rounded-full bg-neutral-900" />}
								</div>
							</div>
							<span class="text-neutral-700 text-sm">{option.label}</span>
						</label>
					);
				})}
			</div>

			{helperText && !error && <p class="text-neutral-500 text-xs">{helperText}</p>}

			{error && <p class="font-medium text-red-600 text-xs">{error}</p>}
		</div>
	);
}
