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

import {BlueskyIcon} from '@fluxer/marketing/src/components/icons/BlueskyIcon';
import {MarketingButton} from '@fluxer/marketing/src/components/MarketingButton';
import {MarketingCard} from '@fluxer/marketing/src/components/MarketingCard';
import {Section} from '@fluxer/marketing/src/components/Section';
import {SupportCard} from '@fluxer/marketing/src/components/SupportCard';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

interface GetInvolvedSectionProps {
	ctx: MarketingContext;
}

export function GetInvolvedSection(props: GetInvolvedSectionProps): JSX.Element {
	const {ctx} = props;

	return (
		<Section
			variant="light"
			title={ctx.i18n.getMessage('company_and_resources.source_and_contribution.get_involved', ctx.locale)}
			description={ctx.i18n.getMessage(
				'company_and_resources.source_and_contribution.fluxer_built_in_open',
				ctx.locale,
			)}
			className="md:py-28"
			id="get-involved"
		>
			<div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
				<SupportCard
					ctx={ctx}
					icon="rocket_launch"
					title={ctx.i18n.getMessage('misc_labels.join_and_spread_word', ctx.locale)}
					description={ctx.i18n.getMessage('beta_and_access.registration_limited_during_beta', ctx.locale)}
					buttonText={ctx.i18n.getMessage('misc_labels.register_now', ctx.locale)}
					buttonHref={`${ctx.appEndpoint}/register`}
					theme="light"
				/>
				<SupportCard
					ctx={ctx}
					icon="chat_centered_text"
					title={ctx.i18n.getMessage('misc_labels.join_fluxer_hq', ctx.locale)}
					description={ctx.i18n.getMessage('misc_labels.get_updates', ctx.locale)}
					buttonText={ctx.i18n.getMessage('misc_labels.join_fluxer_hq', ctx.locale)}
					buttonHref="https://fluxer.gg/fluxer-hq"
					theme="light"
				/>
				<MarketingCard
					theme="light"
					padding="md"
					style="box-shadow: 0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05);"
				>
					<div class="mb-8 text-center">
						<div class="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-[#4641D9] md:h-24 md:w-24">
							<BlueskyIcon class="h-10 w-10 text-white md:h-12 md:w-12" />
						</div>
						<h3 class="title mb-4 text-black text-xl md:text-2xl">
							{ctx.i18n.getMessage('social_and_feeds.bluesky.follow_us', ctx.locale)}
						</h3>
						<p class="body-lg text-gray-700 leading-relaxed">
							{ctx.i18n.getMessage('social_and_feeds.stay_updated_cta', ctx.locale)}{' '}
							<a
								href="https://bsky.app/profile/fluxer.app/rss"
								class="underline hover:text-[#4641D9]"
								target="_blank"
								rel="noopener noreferrer"
							>
								{ctx.i18n.getMessage('social_and_feeds.bluesky.rss_feed', ctx.locale)}
							</a>{' '}
							{ctx.i18n.getMessage('general.or', ctx.locale)}{' '}
							<a
								href="https://blog.fluxer.app/rss/"
								class="underline hover:text-[#4641D9]"
								target="_blank"
								rel="noopener noreferrer"
							>
								{ctx.i18n.getMessage('social_and_feeds.rss.blog_rss_feed', ctx.locale)}
							</a>
							.
						</p>
					</div>
					<div class="mt-auto flex flex-col items-center">
						<MarketingButton
							href="https://bsky.app/profile/fluxer.app"
							size="medium"
							target="_blank"
							rel="noopener noreferrer"
							class="label w-full text-center md:text-lg"
						>
							{ctx.i18n.getMessage('social_and_feeds.follow_fluxer', ctx.locale)}
						</MarketingButton>
					</div>
				</MarketingCard>
				<SupportCard
					ctx={ctx}
					icon="bug"
					title={ctx.i18n.getMessage('misc_labels.report_bugs', ctx.locale)}
					description={ctx.i18n.getMessage('security.testers_access_from_reports', ctx.locale)}
					buttonText={ctx.i18n.getMessage('misc_labels.read_the_guide', ctx.locale)}
					buttonHref="/help/report-bug"
					theme="light"
				/>
				<SupportCard
					ctx={ctx}
					icon="code"
					title={ctx.i18n.getMessage('company_and_resources.source_and_contribution.contribute_code', ctx.locale)}
					description={ctx.i18n.getMessage('product_positioning.open_source.fully_open_source_agplv3', ctx.locale)}
					buttonText={ctx.i18n.getMessage('company_and_resources.source_and_contribution.view_repository', ctx.locale)}
					buttonHref="https://github.com/fluxerapp/fluxer"
					theme="light"
				/>
				<SupportCard
					ctx={ctx}
					icon="shield_check"
					title={ctx.i18n.getMessage('security.found_security_issue', ctx.locale)}
					description={ctx.i18n.getMessage('security.responsible_disclosure_note', ctx.locale)}
					buttonText={ctx.i18n.getMessage('security.security_bug_bounty', ctx.locale)}
					buttonHref="/security"
					theme="light"
				/>
			</div>
		</Section>
	);
}
