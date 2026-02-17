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

import {HashIcon} from '@fluxer/marketing/src/components/icons/HashIcon';
import {SparkleIcon} from '@fluxer/marketing/src/components/icons/SparkleIcon';
import {VideoCameraIcon} from '@fluxer/marketing/src/components/icons/VideoCameraIcon';
import {MarketingButton} from '@fluxer/marketing/src/components/MarketingButton';
import {Section} from '@fluxer/marketing/src/components/Section';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {getFormattedPrice, PricingTier} from '@fluxer/marketing/src/PricingUtils';
import {href} from '@fluxer/marketing/src/UrlUtils';

interface PlutoniumSectionProps {
	ctx: MarketingContext;
}

export function PlutoniumSection(props: PlutoniumSectionProps): JSX.Element {
	const {ctx} = props;
	const monthlyPrice = getFormattedPrice(PricingTier.Monthly, ctx.countryCode);
	const yearlyPrice = getFormattedPrice(PricingTier.Yearly, ctx.countryCode);

	return (
		<Section
			variant="light"
			title={ctx.i18n.getMessage('pricing_and_tiers.plutonium.get_more_with_plutonium', ctx.locale)}
			className="md:py-28"
		>
			<div class="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
				<span class="font-bold text-3xl text-black md:text-4xl">
					{`${monthlyPrice}${ctx.i18n.getMessage('pricing_and_tiers.billing.per_month', ctx.locale)} ${ctx.i18n.getMessage('general.or', ctx.locale)} ${yearlyPrice}${ctx.i18n.getMessage('pricing_and_tiers.billing.per_year_full', ctx.locale)}`}
				</span>
				<span class="inline-flex items-center rounded-xl bg-[#4641D9] px-4 py-2 font-semibold text-sm text-white md:text-base">
					{ctx.i18n.getMessage('pricing_and_tiers.billing.save_percent', ctx.locale)}
				</span>
			</div>
			<p class="lead mx-auto max-w-2xl text-gray-700">
				{ctx.i18n.getMessage('pricing_and_tiers.plutonium.higher_limits_and_early_access', ctx.locale)}
			</p>
			<div class="mx-auto mb-12 grid max-w-4xl grid-cols-1 gap-8 md:mb-16 md:grid-cols-3 md:gap-12">
				<div class="flex flex-col items-center text-center">
					<div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#4641D9]/10 to-[#4641D9]/5 md:h-20 md:w-20">
						<HashIcon class="h-8 w-8 text-[#4641D9] md:h-10 md:w-10" />
					</div>
					<h3 class="title whitespace-nowrap text-black text-lg md:text-xl">
						{ctx.i18n.getMessage('app.profiles_identity.custom_identity', ctx.locale)}
					</h3>
				</div>
				<div class="flex flex-col items-center text-center">
					<div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#4641D9]/10 to-[#4641D9]/5 md:h-20 md:w-20">
						<VideoCameraIcon class="h-8 w-8 text-[#4641D9] md:h-10 md:w-10" />
					</div>
					<h3 class="title whitespace-nowrap text-black text-lg md:text-xl">
						{ctx.i18n.getMessage('press_branding.assets.premium_quality', ctx.locale)}
					</h3>
				</div>
				<div class="flex flex-col items-center text-center">
					<div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#4641D9]/10 to-[#4641D9]/5 md:h-20 md:w-20">
						<SparkleIcon class="h-8 w-8 text-[#4641D9] md:h-10 md:w-10" />
					</div>
					<h3 class="title whitespace-nowrap text-black text-lg md:text-xl">
						{ctx.i18n.getMessage('misc_labels.exclusive_features', ctx.locale)}
					</h3>
				</div>
			</div>
			<div class="text-center">
				<MarketingButton href={href(ctx, '/plutonium')} size="large" class="label md:text-xl">
					{ctx.i18n.getMessage('partner_program.become_partner.learn_more', ctx.locale)}
				</MarketingButton>
			</div>
		</Section>
	);
}
