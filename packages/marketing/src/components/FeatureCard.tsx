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

import {ArrowRightIcon} from '@fluxer/marketing/src/components/icons/ArrowRightIcon';
import {Icon} from '@fluxer/marketing/src/components/icons/IconRegistry';
import {MarketingButton} from '@fluxer/marketing/src/components/MarketingButton';
import {MarketingCard} from '@fluxer/marketing/src/components/MarketingCard';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

type FeatureIcon =
	| 'chats'
	| 'microphone'
	| 'palette'
	| 'magnifying_glass'
	| 'devices'
	| 'gear'
	| 'heart'
	| 'globe'
	| 'server'
	| 'newspaper';

interface FeatureCardProps {
	ctx: MarketingContext;
	icon: FeatureIcon;
	title: string;
	description: string;
	features: ReadonlyArray<string>;
	learnMoreLink?: string;
}

export function FeatureCard(props: FeatureCardProps): JSX.Element {
	const textColor = 'text-gray-900';
	const descriptionColor = 'text-gray-600';

	return (
		<MarketingCard theme="light" padding="md" class="relative rounded-2xl">
			{props.learnMoreLink && (
				<MarketingButton
					href={props.learnMoreLink}
					size="small"
					target="_blank"
					rel="noopener noreferrer"
					class="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 md:top-6 md:right-6"
				>
					{props.ctx.i18n.getMessage('misc_labels.learn_more', props.ctx.locale)}
					<ArrowRightIcon class="h-3.5 w-3.5" />
				</MarketingButton>
			)}
			<div class="mb-6">
				<div class="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4641D9]/10 to-[#4641D9]/5 md:h-16 md:w-16">
					<Icon name={props.icon} class="h-7 w-7 text-[#4641D9] md:h-8 md:w-8" />
				</div>
				<h3 class={`title ${textColor} mb-3`}>{props.title}</h3>
				<p class={`body-lg ${descriptionColor}`}>{props.description}</p>
			</div>
			<div class="mt-2 flex-1">
				<ul class="space-y-3">
					{props.features.map((feature, index) => (
						<li key={`${index}-${feature}`} class="flex items-start gap-3">
							<span class="mt-[.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#4641D9]" />
							<span class={`body-lg ${textColor}`}>{feature}</span>
						</li>
					))}
				</ul>
			</div>
		</MarketingCard>
	);
}
