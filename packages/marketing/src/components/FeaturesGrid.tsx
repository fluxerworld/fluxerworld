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
	FeaturePillWithTheme,
	type FeatureStatus,
	type FeatureTheme,
} from '@fluxer/marketing/src/components/FeaturePill';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

export interface FeaturePillItem {
	text: string;
	status: FeatureStatus;
}

interface FeaturesGridProps {
	ctx: MarketingContext;
	title: string;
	description: string;
	features: ReadonlyArray<FeaturePillItem>;
	theme: FeatureTheme;
}

export function FeaturesGrid(props: FeaturesGridProps): JSX.Element {
	const classSet = getThemeClasses(props.theme);

	return (
		<section class={`${classSet.bgClass} px-6 py-20 md:py-32`}>
			<div class="mx-auto max-w-7xl">
				<div class="mb-16 text-center">
					<h2 class={`mb-6 font-bold text-3xl ${classSet.textClass} md:text-4xl`}>{props.title}</h2>
					<p class={`mx-auto max-w-3xl text-lg ${classSet.descClass} md:text-xl`}>{props.description}</p>
				</div>
				<div class="flex flex-wrap justify-center gap-3">
					{props.features.map((feature) => (
						<FeaturePillWithTheme text={feature.text} status={feature.status} theme={props.theme} />
					))}
				</div>
			</div>
		</section>
	);
}

function getThemeClasses(theme: FeatureTheme): {bgClass: string; textClass: string; descClass: string} {
	if (theme === 'dark') {
		return {bgClass: 'bg-[#4641D9]', textClass: 'text-white', descClass: 'text-white/80'};
	}
	return {bgClass: 'bg-white', textClass: 'text-black', descClass: 'text-gray-600'};
}
