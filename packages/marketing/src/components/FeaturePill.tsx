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

export type FeatureStatus = 'live' | 'comingSoon';
export type FeatureTheme = 'light' | 'dark';

interface FeaturePillProps {
	text: string;
	status: FeatureStatus;
}

interface FeaturePillThemeProps {
	text: string;
	status: FeatureStatus;
	theme: FeatureTheme;
}

export function FeaturePill(props: FeaturePillProps): JSX.Element {
	return (
		<span class="inline-block rounded-lg border border-white/20 bg-white px-3 py-2 font-medium text-[#4641D9] text-sm shadow-sm sm:px-4 sm:py-3 sm:text-base">
			{props.text}
		</span>
	);
}

export function FeaturePillWithTheme(props: FeaturePillThemeProps): JSX.Element {
	const pillClass =
		props.theme === 'light'
			? 'inline-block rounded-lg bg-[#4641D9] px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base font-medium text-white shadow-sm border border-gray-200'
			: 'inline-block rounded-lg bg-white px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base font-medium text-[#4641D9] shadow-sm border border-white/20';

	return <span class={pillClass}>{props.text}</span>;
}
