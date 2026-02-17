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

export type ToggleSwitchSize = 'small' | 'medium' | 'large';

export interface ToggleSwitchProps {
	name: string;
	label?: string;
	checked: boolean;
	disabled?: boolean;
	size?: ToggleSwitchSize;
	helperText?: string;
	id?: string;
	onChangeScript?: string;
}

const sizeClasses: Record<ToggleSwitchSize, {track: string; thumb: string}> = {
	small: {
		track: 'w-8 h-5',
		thumb: 'w-3 h-3 translate-x-3',
	},
	medium: {
		track: 'w-11 h-6',
		thumb: 'w-4 h-4 translate-x-5',
	},
	large: {
		track: 'w-14 h-7',
		thumb: 'w-5 h-5 translate-x-7',
	},
};

export function ToggleSwitch({
	name,
	label,
	checked,
	disabled = false,
	size = 'medium',
	helperText,
	id,
	onChangeScript,
}: ToggleSwitchProps) {
	const switchId = id || name;

	const {track, thumb} = sizeClasses[size];

	const trackClass = checked ? `bg-neutral-900` : `bg-neutral-300`;

	const thumbPosition = checked ? thumb : 'translate-x-0.5';

	return (
		<div class="space-y-1">
			<label
				for={switchId}
				class={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
			>
				<div class="relative">
					<input
						type="checkbox"
						id={switchId}
						name={name}
						checked={checked}
						disabled={disabled}
						class="sr-only"
						onchange={onChangeScript}
					/>
					<div class={`${track} ${trackClass} rounded-full transition-colors duration-200 ease-in-out`}>
						<div
							class={`${thumb} ${thumbPosition} absolute top-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out`}
						/>
					</div>
				</div>

				{label && <span class="font-medium text-neutral-700 text-sm">{label}</span>}
			</label>

			{helperText && <p class="pl-14 text-neutral-500 text-xs">{helperText}</p>}
		</div>
	);
}
