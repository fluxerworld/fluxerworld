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

import {ChatsCircleIcon} from '@fluxer/marketing/src/components/icons/ChatsCircleIcon';
import {FluxerPartnerIcon} from '@fluxer/marketing/src/components/icons/FluxerPartnerIcon';
import {FluxerPremiumIcon} from '@fluxer/marketing/src/components/icons/FluxerPremiumIcon';
import {SealCheckIcon} from '@fluxer/marketing/src/components/icons/SealCheckIcon';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {href} from '@fluxer/marketing/src/UrlUtils';

interface PartnerSectionProps {
	ctx: MarketingContext;
}

export function PartnerSection(props: PartnerSectionProps): JSX.Element {
	const {ctx} = props;

	return (
		<section class="bg-gradient-to-b from-gray-50 to-white px-6 pb-24 sm:px-8 md:px-12 md:pb-40 lg:px-16 xl:px-20">
			<div class="mx-auto max-w-6xl rounded-3xl bg-gradient-to-br from-black to-gray-900 p-10 text-white shadow-xl md:p-16 lg:p-20">
				<div class="mb-10 text-center md:mb-12">
					<div class="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm md:mb-8 md:h-24 md:w-24">
						<FluxerPartnerIcon class="h-10 w-10 md:h-12 md:w-12" />
					</div>
					<h2 class="display mb-6 text-3xl text-white md:mb-8 md:text-4xl lg:text-5xl">
						{ctx.i18n.getMessage('partner_program.become_partner.heading', ctx.locale)}
					</h2>
					<p class="lead mx-auto max-w-3xl text-white/90">
						{ctx.i18n.getMessage('partner_program.who_its_for', ctx.locale)}
					</p>
				</div>
				<div class="mx-auto mb-10 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3 md:mb-12 md:gap-8">
					<div class="flex flex-col items-center text-center">
						<div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm md:h-20 md:w-20">
							<FluxerPremiumIcon class="h-8 w-8 md:h-10 md:w-10" />
						</div>
						<p class="body-lg font-semibold text-white">
							{ctx.i18n.getMessage('partner_program.perks.free_plutonium.label', ctx.locale)}
						</p>
					</div>
					<div class="flex flex-col items-center text-center">
						<div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm md:h-20 md:w-20">
							<SealCheckIcon class="h-8 w-8 md:h-10 md:w-10" />
						</div>
						<p class="body-lg font-semibold text-white">
							{ctx.i18n.getMessage('app.communities.verification.verified_community', ctx.locale)}
						</p>
					</div>
					<div class="flex flex-col items-center text-center">
						<div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm md:h-20 md:w-20">
							<ChatsCircleIcon class="h-8 w-8 md:h-10 md:w-10" />
						</div>
						<p class="body-lg font-semibold text-white">
							{ctx.i18n.getMessage('partner_program.perks.direct_team_access.label', ctx.locale)}
						</p>
					</div>
				</div>
				<div class="text-center">
					<a
						href={href(ctx, '/partners')}
						class="label inline-block rounded-lg bg-white px-8 py-4 text-black transition-colors hover:bg-opacity-90"
					>
						{ctx.i18n.getMessage('partner_program.become_partner.call_to_action', ctx.locale)}
					</a>
				</div>
			</div>
		</section>
	);
}
