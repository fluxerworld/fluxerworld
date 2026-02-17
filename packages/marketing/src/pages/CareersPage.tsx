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
import {ChatsCircleIcon} from '@fluxer/marketing/src/components/icons/ChatsCircleIcon';
import {CodeIcon} from '@fluxer/marketing/src/components/icons/CodeIcon';
import {FluxerStaffIcon} from '@fluxer/marketing/src/components/icons/FluxerStaffIcon';
import {PaletteIcon} from '@fluxer/marketing/src/components/icons/PaletteIcon';
import {ShieldCheckIcon} from '@fluxer/marketing/src/components/icons/ShieldCheckIcon';
import {TranslateIcon} from '@fluxer/marketing/src/components/icons/TranslateIcon';
import {Section} from '@fluxer/marketing/src/components/Section';
import {SupportCard} from '@fluxer/marketing/src/components/SupportCard';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import {GRADIENTS} from '@fluxer/ui/src/styles/Gradients';
import {SPACING} from '@fluxer/ui/src/styles/Spacing';
import type {Context} from 'hono';

export async function renderCareersPage(c: Context, ctx: MarketingContext): Promise<Response> {
	const content: ReadonlyArray<JSX.Element> = [
		renderHeroSection(ctx),
		renderCommunityTeamSection(ctx),
		renderContributeSection(ctx),
		renderFutureSection(ctx),
		renderCtaSection(ctx),
	];

	const meta = pageMeta(
		ctx.i18n.getMessage('company_and_resources.careers.careers_at_fluxer', ctx.locale),
		ctx.i18n.getMessage('misc_labels.join_fluxer_community_contribute', ctx.locale),
		'website',
	);
	const html = renderLayout(c, ctx, meta, content);
	return c.html(html);
}

function renderHeroSection(ctx: MarketingContext): JSX.Element {
	return (
		<HeroBase
			icon={<FluxerStaffIcon class="h-14 w-14 text-white md:h-18 md:w-18" />}
			title={ctx.i18n.getMessage('misc_labels.join_team_behind_fluxer', ctx.locale)}
			description={ctx.i18n.getMessage('donations.why_support', ctx.locale)}
			extraContent={<div />}
			customPadding={defaultHeroPadding()}
		/>
	);
}

function renderContributeSection(ctx: MarketingContext): JSX.Element {
	return (
		<Section
			variant="dark"
			title={ctx.i18n.getMessage('company_and_resources.source_and_contribution.ways_to_contribute', ctx.locale)}
			description={ctx.i18n.getMessage(
				'company_and_resources.source_and_contribution.fluxer_built_in_open',
				ctx.locale,
			)}
		>
			<div class="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12">
				<SupportCard
					ctx={ctx}
					icon="code"
					title={ctx.i18n.getMessage('product_positioning.open_source.label', ctx.locale)}
					description={ctx.i18n.getMessage(
						'company_and_resources.source_and_contribution.fix_bugs_ship_features',
						ctx.locale,
					)}
					buttonText={ctx.i18n.getMessage('company_and_resources.source_and_contribution.view_repository', ctx.locale)}
					buttonHref="https://github.com/fluxerapp/fluxer"
				/>
				<SupportCard
					ctx={ctx}
					icon="translate"
					title={ctx.i18n.getMessage(
						'company_and_resources.source_and_contribution.translation.localization_label',
						ctx.locale,
					)}
					description={ctx.i18n.getMessage(
						'company_and_resources.source_and_contribution.translation.help_translate',
						ctx.locale,
					)}
					buttonText="i18n@fluxer.app"
					buttonHref="mailto:i18n@fluxer.app"
				/>
				<SupportCard
					ctx={ctx}
					icon="chat_centered_text"
					title={ctx.i18n.getMessage('app.communities.community', ctx.locale)}
					description={ctx.i18n.getMessage(
						'company_and_resources.community_team.share_feedback_report_bugs',
						ctx.locale,
					)}
					buttonText={ctx.i18n.getMessage('misc_labels.join_fluxer_hq', ctx.locale)}
					buttonHref="https://fluxer.gg/fluxer-hq"
				/>
				<SupportCard
					ctx={ctx}
					icon="bug"
					title={ctx.i18n.getMessage('security.security_reports', ctx.locale)}
					description={ctx.i18n.getMessage('security.report_vulnerabilities', ctx.locale)}
					buttonText={ctx.i18n.getMessage('security.security_bug_bounty', ctx.locale)}
					buttonHref="/security"
				/>
				<SupportCard
					ctx={ctx}
					icon="shield_check"
					title={ctx.i18n.getMessage('misc_labels.trust_and_safety', ctx.locale)}
					description={ctx.i18n.getMessage('app.communities.moderation.report_people_or_communities', ctx.locale)}
					buttonText="safety@fluxer.app"
					buttonHref="mailto:safety@fluxer.app"
				/>
				<SupportCard
					ctx={ctx}
					icon="fluxer_partner"
					title={ctx.i18n.getMessage('partner_program.become_partner.heading', ctx.locale)}
					description={ctx.i18n.getMessage('partner_program.become_partner.if_youre_a_creator_or', ctx.locale)}
					buttonText={ctx.i18n.getMessage('partner_program.become_partner.learn_about_partners', ctx.locale)}
					buttonHref="/partners"
				/>
			</div>
		</Section>
	);
}

function renderCommunityTeamSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={`${GRADIENTS.light} ${SPACING.large}`}>
			<div class="mx-auto max-w-7xl">
				<div class="mb-16 text-center md:mb-20">
					<h2 class="display mb-6 text-5xl text-black md:mb-8 md:text-6xl lg:text-7xl">
						{ctx.i18n.getMessage('company_and_resources.community_team.fluxer_community_team', ctx.locale)}
					</h2>
					<p class="lead lead-soft mx-auto max-w-3xl text-gray-700 text-xl md:text-2xl">
						{ctx.i18n.getMessage('community_funding_and_roles.non_paid_recurring_role', ctx.locale)}
					</p>
				</div>
				<div class="mx-auto flex max-w-5xl flex-wrap justify-center gap-3 sm:gap-4 md:gap-5 lg:gap-6">
					{renderCommunityPill(
						<CodeIcon class="h-6 w-6 text-[#4641D9] md:h-7 md:w-7" />,
						ctx.i18n.getMessage('misc_labels.software_development', ctx.locale),
					)}
					{renderCommunityPill(
						<TranslateIcon class="h-6 w-6 text-[#4641D9] md:h-7 md:w-7" />,
						ctx.i18n.getMessage('company_and_resources.source_and_contribution.translation.label', ctx.locale),
					)}
					{renderCommunityPill(
						<PaletteIcon class="h-6 w-6 text-[#4641D9] md:h-7 md:w-7" />,
						ctx.i18n.getMessage('misc_labels.design_and_branding', ctx.locale),
					)}
					{renderCommunityPill(
						<ShieldCheckIcon class="h-6 w-6 text-[#4641D9] md:h-7 md:w-7" />,
						ctx.i18n.getMessage('misc_labels.trust_and_safety', ctx.locale),
					)}
				</div>
				<div class="mt-10 text-center md:mt-12">
					<a
						href="mailto:careers@fluxer.app"
						class="label inline-flex items-center justify-center rounded-xl bg-[#4641D9] px-8 py-4 text-base text-white shadow-lg transition hover:bg-opacity-90 md:text-lg"
					>
						careers@fluxer.app
					</a>
				</div>
			</div>
		</section>
	);
}

function renderCommunityPill(icon: JSX.Element, label: string): JSX.Element {
	return (
		<div class="inline-flex items-center gap-3 rounded-full border border-gray-200/80 bg-white px-5 py-3.5 shadow-md sm:gap-4 sm:px-6 sm:py-4 md:px-7 lg:shadow-lg">
			{icon}
			<span class="body-lg whitespace-nowrap text-base text-gray-800 md:text-lg">{label}</span>
		</div>
	);
}

function renderFutureSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={`bg-white ${SPACING.large}`}>
			<div class="mx-auto max-w-7xl text-center">
				<h2 class="display mb-6 text-4xl text-black md:mb-8 md:text-5xl lg:text-6xl">
					{ctx.i18n.getMessage('community_funding_and_roles.future_paid_roles_heading', ctx.locale)}
				</h2>
				<p class="lead lead-soft mx-auto mb-10 max-w-3xl text-gray-700 text-xl md:mb-12 md:text-2xl">
					{ctx.i18n.getMessage('community_funding_and_roles.future_paid_roles_note', ctx.locale)}
				</p>
				<div class="mx-auto max-w-4xl rounded-3xl border border-gray-200/80 bg-white/95 p-8 text-left shadow-xl backdrop-blur-sm md:p-10">
					<p class="body-lg mb-4 text-base text-gray-900 leading-relaxed md:mb-5 md:text-lg">
						{ctx.i18n.getMessage('community_funding_and_roles.focused_on_product', ctx.locale)}
					</p>
					<p class="body-lg text-base text-gray-700 leading-relaxed md:text-lg">
						{ctx.i18n.getMessage('community_funding_and_roles.sustainability_note', ctx.locale)}
					</p>
				</div>
			</div>
		</section>
	);
}

function renderCtaSection(ctx: MarketingContext): JSX.Element {
	return (
		<section class={GRADIENTS.light}>
			<div class={`${GRADIENTS.cta} rounded-t-3xl`}>
				<div class={`mx-auto max-w-4xl ${SPACING.cta} text-center`}>
					<h2 class="display mb-6 text-4xl md:mb-8 md:text-5xl lg:text-6xl">
						{ctx.i18n.getMessage('company_and_resources.source_and_contribution.want_to_help_build_fluxer', ctx.locale)}
					</h2>
					<p class="body-lg mx-auto mb-8 max-w-3xl text-white/90 md:mb-10">
						{ctx.i18n.getMessage('company_and_resources.careers.share_a_bit_about_yourself', ctx.locale)}
					</p>
					<div class="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
						<a
							href="mailto:careers@fluxer.app"
							class="label inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-[#4641D9] shadow-lg transition hover:bg-gray-100"
						>
							careers@fluxer.app
						</a>
						<a
							href="https://fluxer.gg/fluxer-hq"
							target="_blank"
							rel="noopener noreferrer"
							class="label inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-white hover:bg-white/15"
						>
							<ChatsCircleIcon class="h-5 w-5 text-white" />
							<span>{ctx.i18n.getMessage('misc_labels.join_fluxer_hq', ctx.locale)}</span>
						</a>
					</div>
				</div>
			</div>
		</section>
	);
}
