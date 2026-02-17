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

import {defaultHeroPadding, HeroBase} from '@fluxer/marketing/src/components/HeroBase';
import {ArrowRightIcon} from '@fluxer/marketing/src/components/icons/ArrowRightIcon';
import {CheckIcon} from '@fluxer/marketing/src/components/icons/CheckIcon';
import {FluxerPartnerIcon} from '@fluxer/marketing/src/components/icons/FluxerPartnerIcon';
import {Icon} from '@fluxer/marketing/src/components/icons/IconRegistry';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import {href} from '@fluxer/marketing/src/UrlUtils';
import {GRADIENTS} from '@fluxer/ui/src/styles/Gradients';
import {SPACING} from '@fluxer/ui/src/styles/Spacing';
import type {Context} from 'hono';

export async function renderPartnersPage(c: Context, ctx: MarketingContext): Promise<Response> {
	const content: ReadonlyArray<JSX.Element> = [renderHeroSection(ctx), renderPerksSection(ctx), renderCtaSection(ctx)];

	const meta = pageMeta(
		ctx.i18n.getMessage('partner_program.label', ctx.locale),
		ctx.i18n.getMessage('partner_program.become_partner.call_to_action', ctx.locale),
		'website',
	);
	const html = renderLayout(c, ctx, meta, content);
	return c.html(html);
}

function renderHeroSection(ctx: MarketingContext): JSX.Element {
	return (
		<HeroBase
			icon={<FluxerPartnerIcon class="h-14 w-14 md:h-18 md:w-18" />}
			title={ctx.i18n.getMessage('partner_program.become_partner.heading', ctx.locale)}
			description={ctx.i18n.getMessage('partner_program.description', ctx.locale)}
			extraContent={<div />}
			customPadding={defaultHeroPadding()}
		/>
	);
}

function renderPerksSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={`bg-white ${SPACING.large}`}>
			<div class="mx-auto max-w-6xl">
				<div class="mb-12 text-center md:mb-16">
					<h2 class="display mb-6 text-4xl text-black md:mb-8 md:text-5xl lg:text-6xl">
						{ctx.i18n.getMessage('partner_program.perks.heading', ctx.locale)}
					</h2>
					<p class="lead mx-auto max-w-3xl text-gray-700">
						{ctx.i18n.getMessage('partner_program.who_its_for', ctx.locale)}
					</p>
				</div>
				<div class="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
					{renderPerkCard(
						ctx,
						'fluxer_premium',
						ctx.i18n.getMessage('partner_program.perks.free_plutonium.label', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.free_plutonium.description', ctx.locale),
						false,
						'/plutonium',
					)}
					{renderPerkCard(
						ctx,
						'fluxer_partner',
						ctx.i18n.getMessage('partner_program.perks.partner_badge.label', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.partner_badge.description', ctx.locale),
						false,
						'',
					)}
					{renderPerkCard(
						ctx,
						'seal_check',
						ctx.i18n.getMessage('app.communities.verification.label', ctx.locale),
						ctx.i18n.getMessage('app.communities.verification.value_statement', ctx.locale),
						false,
						'',
					)}
					{renderPerkCard(
						ctx,
						'link',
						ctx.i18n.getMessage('partner_program.perks.custom_vanity_url.label', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.custom_vanity_url.description', ctx.locale),
						false,
						'',
					)}
					{renderPerkCard(
						ctx,
						'fluxer_staff',
						ctx.i18n.getMessage('partner_program.perks.direct_team_access.label', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.direct_team_access.description', ctx.locale),
						false,
						'',
					)}
					{renderPerkCard(
						ctx,
						'magnifying_glass',
						ctx.i18n.getMessage('app.communities.featured_in_discovery', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.discovery_visibility', ctx.locale),
						true,
						'',
					)}
					{renderPerkCard(
						ctx,
						'gif',
						ctx.i18n.getMessage('app.customization.animated_profile.animated_avatars_and_banners', ctx.locale),
						ctx.i18n.getMessage('app.customization.animated_profile.stand_out_animated_profile', ctx.locale),
						false,
						'',
					)}
					{renderPerkCard(
						ctx,
						'arrow_up',
						ctx.i18n.getMessage('partner_program.perks.increased_limits.label', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.increased_limits.description', ctx.locale),
						false,
						'',
					)}
					{renderPerkCard(
						ctx,
						'rocket',
						ctx.i18n.getMessage('beta_and_access.early_access.label', ctx.locale),
						ctx.i18n.getMessage('beta_and_access.early_access.be_first_to_try', ctx.locale),
						false,
						'',
					)}
					{renderPerkCard(
						ctx,
						'coins',
						ctx.i18n.getMessage('partner_program.perks.creator_monetization.label', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.creator_monetization.description', ctx.locale),
						true,
						'',
					)}
					{renderPerkCard(
						ctx,
						'microphone',
						ctx.i18n.getMessage('partner_program.perks.vip_voice_servers.label', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.vip_voice_servers.description', ctx.locale),
						true,
						'',
					)}
					{renderPerkCard(
						ctx,
						'tshirt',
						ctx.i18n.getMessage('partner_program.perks.exclusive_merch.label', ctx.locale),
						ctx.i18n.getMessage('partner_program.perks.exclusive_merch.description', ctx.locale),
						true,
						'',
					)}
				</div>
			</div>
		</section>
	);
}

type PerkIcon =
	| 'fluxer_premium'
	| 'fluxer_partner'
	| 'fluxer_staff'
	| 'seal_check'
	| 'link'
	| 'magnifying_glass'
	| 'arrow_up'
	| 'rocket'
	| 'coins'
	| 'microphone'
	| 'tshirt'
	| 'gif'
	| 'sparkle';

function renderPerkCard(
	ctx: MarketingContext,
	iconName: PerkIcon,
	title: string,
	description: string,
	comingSoon: boolean,
	link: string,
): JSX.Element {
	const hasLink = link.length > 0;

	return (
		<div class="relative flex h-full flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-lg md:p-7">
			{comingSoon ? (
				<div class="caption absolute -top-2 -right-2 rounded-full bg-[#4641D9] px-3 py-1 text-white">
					{ctx.i18n.getMessage('general.coming_soon.label', ctx.locale)}
				</div>
			) : null}
			{hasLink ? (
				<a
					href={href(ctx, link)}
					class="caption absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[#4641D9] px-3 py-1 text-white transition hover:bg-[#3d38c7]"
				>
					{ctx.i18n.getMessage('partner_program.perks.see_perks', ctx.locale)}
					<ArrowRightIcon class="h-3 w-3" />
				</a>
			) : null}
			<div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#4641D9]/10">
				<Icon name={iconName} class="h-8 w-8 text-[#4641D9]" />
			</div>
			<h3 class="title-sm mb-2 text-black">{title}</h3>
			<p class="body text-gray-600">{description}</p>
		</div>
	);
}

function renderCtaSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={GRADIENTS.light}>
			<div class={`${GRADIENTS.cta} rounded-t-3xl`}>
				<div class={`mx-auto max-w-4xl ${SPACING.cta} text-center`}>
					<h2 class="display mb-6 text-4xl md:mb-8 md:text-5xl lg:text-6xl">
						{ctx.i18n.getMessage('partner_program.become_partner.ready_prompt', ctx.locale)}
					</h2>
					<p class="body-lg mx-auto mb-8 max-w-3xl text-white/90 md:mb-10">
						{ctx.i18n.getMessage('partner_program.apply.instructions', ctx.locale)}
					</p>
					<div class="mb-8 rounded-2xl border border-white/15 bg-white/5 p-6 text-left md:p-8">
						<ul class="body space-y-3 text-white/90">
							<li class="flex items-start gap-3">
								<CheckIcon class="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
								<span>{ctx.i18n.getMessage('partner_program.requirements.name_and_username', ctx.locale)}</span>
							</li>
							<li class="flex items-start gap-3">
								<CheckIcon class="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
								<span>{ctx.i18n.getMessage('partner_program.requirements.links_to_content', ctx.locale)}</span>
							</li>
							<li class="flex items-start gap-3">
								<CheckIcon class="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
								<span>{ctx.i18n.getMessage('partner_program.requirements.audience_description', ctx.locale)}</span>
							</li>
							<li class="flex items-start gap-3">
								<CheckIcon class="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
								<span>{ctx.i18n.getMessage('partner_program.requirements.usage_plan', ctx.locale)}</span>
							</li>
						</ul>
					</div>
					<a
						href="mailto:partners@fluxer.app"
						class="label inline-block rounded-xl bg-white px-8 py-4 text-[#4641D9] shadow-lg transition hover:bg-gray-100"
					>
						{ctx.i18n.getMessage('partner_program.become_partner.apply_email', ctx.locale)}
					</a>
					<p class="body-sm mt-6 text-white/80">
						{ctx.i18n.getMessage('partner_program.apply.response_time', ctx.locale)}
					</p>
				</div>
			</div>
		</section>
	);
}
