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

export interface SliderInputProps {
	id: string;
	name: string;
	label: string;
	min: number;
	max: number;
	value: number;
	step?: number;
	rangeText?: string;
	displayId?: string;
	disabled?: boolean;
}

function getSliderPercent(value: number, min: number, max: number): number {
	const range = max - min;
	if (range <= 0) {
		return 0;
	}
	return ((value - min) / range) * 100;
}

export const SliderInput: FC<SliderInputProps> = ({
	id,
	name,
	label,
	min,
	max,
	value: initialValue,
	step = 1,
	rangeText,
	displayId,
	disabled = false,
}) => {
	const actualDisplayId = displayId ?? `${id}-value`;
	const rangeTextId = rangeText ? `${id}-range-text` : undefined;
	const sliderPercent = getSliderPercent(initialValue, min, max);
	const sliderStyle = `--slider-percent: ${sliderPercent}%;`;
	const onInputScript = `const value=Number(this.value);const min=${min};const max=${max};const percent=max>min?((value-min)/(max-min))*100:0;this.style.setProperty('--slider-percent', percent + '%');const output=document.getElementById('${actualDisplayId}');if(output){output.textContent=String(value);}`;

	return (
		<>
			<div class="flex items-center justify-between">
				<label for={id} class="font-medium text-neutral-800 text-sm">
					{label}
				</label>
				{rangeText && (
					<span id={rangeTextId} class="text-neutral-500 text-xs">
						{rangeText}
					</span>
				)}
			</div>
			<div class="flex items-center gap-4">
				<input
					type="range"
					id={id}
					name={name}
					min={min}
					max={max}
					step={step}
					value={initialValue}
					disabled={disabled}
					aria-describedby={rangeTextId}
					oninput={onInputScript}
					style={sliderStyle}
					class="slider-input w-full flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<output
					id={actualDisplayId}
					for={id}
					aria-live="polite"
					class={`w-12 text-right font-medium text-sm tabular-nums ${disabled ? 'text-neutral-400' : 'text-neutral-900'}`}
				>
					{initialValue}
				</output>
			</div>
		</>
	);
};
