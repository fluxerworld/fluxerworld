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

import type {LabelProps, TextProps} from '@fluxer/ui/src/types/Common';
import {type ColorIntensity, type ColorTone, getColorClasses} from '@fluxer/ui/src/utils/ColorVariants';

export type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger';
export interface BadgeProps extends TextProps {
	variant?: BadgeVariant;
	intensity?: ColorIntensity;
}

export function Badge({text, variant = 'default', intensity = 'normal'}: BadgeProps) {
	const toneMapping: Record<BadgeVariant, ColorTone> = {
		default: 'neutral',
		info: 'info',
		success: 'success',
		warning: 'warning',
		danger: 'danger',
	};
	const tone = toneMapping[variant];
	const colorClasses = getColorClasses(tone, intensity);

	return (
		<span class={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${colorClasses}`}>
			{text}
		</span>
	);
}

export interface UnifiedBadgeProps extends LabelProps {
	tone: ColorTone;
	intensity?: ColorIntensity;
	rounded?: 'full' | 'default';
}

export function UnifiedBadge({label, tone, intensity = 'normal', rounded = 'full'}: UnifiedBadgeProps) {
	const colorClasses = getColorClasses(tone, intensity);
	const roundedClass = rounded === 'full' ? 'rounded-full' : 'rounded';

	return (
		<span class={`inline-flex items-center ${roundedClass} px-2 py-1 font-medium text-xs ${colorClasses}`}>
			{label}
		</span>
	);
}

export interface PillProps extends Omit<UnifiedBadgeProps, 'rounded'> {}

export function Pill({label, tone, intensity = 'normal'}: PillProps) {
	return <UnifiedBadge label={label} tone={tone} intensity={intensity} rounded="full" />;
}
