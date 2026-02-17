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

import {Icon} from '@fluxer/marketing/src/components/icons/IconRegistry';
import {MarketingButton} from '@fluxer/marketing/src/components/MarketingButton';
import {MarketingCard} from '@fluxer/marketing/src/components/MarketingCard';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

type SupportIcon =
	| 'rocket_launch'
	| 'fluxer_partner'
	| 'chat_centered_text'
	| 'bluesky'
	| 'bug'
	| 'code'
	| 'translate'
	| 'shield_check';

interface SupportCardProps {
	ctx: MarketingContext;
	icon: SupportIcon;
	title: string;
	description: string;
	buttonText: string;
	buttonHref: string;
	theme?: 'light' | 'dark';
}

export function SupportCard(props: SupportCardProps): JSX.Element {
	const linkProps = getLinkProps(props.buttonHref);
	const theme = props.theme ?? 'light';

	return (
		<MarketingCard
			theme={theme}
			padding="md"
			style="box-shadow: 0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05);"
		>
			<div class="mb-8 text-center">
				<div
					class={`mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl md:h-24 md:w-24 ${
						theme === 'dark' ? 'bg-white/20' : 'bg-[#4641D9]'
					}`}
				>
					<Icon
						name={props.icon}
						class={`md:h-12 md:w-12 ${theme === 'dark' ? 'h-10 w-10 text-white' : 'h-10 w-10 text-white'}`}
					/>
				</div>
				<h3 class={`title mb-4 text-xl md:text-2xl ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
					{props.title}
				</h3>
				<p class={`body-lg leading-relaxed ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
					{props.description}
				</p>
			</div>
			<div class="mt-auto flex flex-col items-center">
				<MarketingButton
					href={props.buttonHref}
					size="medium"
					target={linkProps.target}
					rel={linkProps.rel}
					class={`label w-full text-center shadow-md md:text-lg ${
						theme === 'dark' ? 'bg-white text-[#4641D9] hover:bg-gray-100' : ''
					}`}
				>
					{props.buttonText}
				</MarketingButton>
			</div>
		</MarketingCard>
	);
}

function getLinkProps(href: string): {target?: '_blank' | '_self' | '_parent' | '_top'; rel?: string} {
	if (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('mailto:')) {
		return {target: '_blank', rel: 'noopener noreferrer'};
	}
	return {};
}
