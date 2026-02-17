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
import {FluxerLogoWordmarkIcon} from '@fluxer/marketing/src/components/icons/FluxerLogoWordmarkIcon';
import {HeartIcon} from '@fluxer/marketing/src/components/icons/HeartIcon';
import {RssIcon} from '@fluxer/marketing/src/components/icons/RssIcon';
import {MarketingButtonInverted} from '@fluxer/marketing/src/components/MarketingButton';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {href} from '@fluxer/marketing/src/UrlUtils';
import {GRADIENTS} from '@fluxer/ui/src/styles/Gradients';

const linkClass = 'body-lg text-white/90 transition-colors hover:text-white hover:underline';

interface FooterLinkProps {
	href: string;
	children: JSX.Element | string;
}

function FooterLink(props: FooterLinkProps): JSX.Element {
	return (
		<li>
			<a href={props.href} class={linkClass}>
				{props.children}
			</a>
		</li>
	);
}

interface FooterSectionProps {
	title: string;
	children: JSX.Element | Array<JSX.Element>;
	class?: string;
}

function FooterSection(props: FooterSectionProps): JSX.Element {
	return (
		<div class={props.class}>
			<h3 class="title mb-4 text-white md:mb-6">{props.title}</h3>
			<ul class="space-y-3">{props.children}</ul>
		</div>
	);
}

interface FooterProps {
	ctx: MarketingContext;
	className?: string;
}

export function Footer(props: FooterProps): JSX.Element {
	const {ctx, className = ''} = props;
	const link = (path: string) => href(ctx, path);

	return (
		<footer
			class={`${GRADIENTS.purple} px-6 py-20 text-white sm:px-8 md:px-12 md:py-24 lg:px-16 xl:px-20 ${className}`}
		>
			<div class="mx-auto max-w-7xl">
				<div class="mb-10 md:mb-12">
					<div class="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
						<div class="flex flex-col items-start gap-3">
							<div class="flex shrink-0 items-center justify-center sm:h-12 sm:w-12 sm:rounded-full sm:bg-white/10">
								<HeartIcon class="h-8 w-8 text-white" />
							</div>
							<p class="body-lg max-w-xl text-white/90">
								{ctx.i18n.getMessage('footer.help_support_an_independent_communication', ctx.locale)}
							</p>
						</div>
						<MarketingButtonInverted
							href={link('/donate')}
							size="medium"
							class="mt-2 inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-full transition-opacity hover:opacity-90 lg:mt-0"
						>
							{ctx.i18n.getMessage('footer.donate', ctx.locale)}
							<ArrowRightIcon class="h-4 w-4 shrink-0" />
						</MarketingButtonInverted>
					</div>
				</div>

				<div class="mb-10">
					<FluxerLogoWordmarkIcon class="h-8" />
				</div>

				<div class="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10 md:gap-x-12 md:gap-y-10 min-[480px]:grid-cols-2 min-[480px]:gap-x-6 min-[480px]:gap-y-8">
					<FooterSection title={ctx.i18n.getMessage('footer.fluxer', ctx.locale)}>
						<FooterLink href={link('/plutonium')}>
							{ctx.i18n.getMessage('footer.plutonium_tier', ctx.locale)}
						</FooterLink>
						<FooterLink href={link('/partners')}>{ctx.i18n.getMessage('footer.partners', ctx.locale)}</FooterLink>
						<FooterLink href={link('/download')}>{ctx.i18n.getMessage('footer.download', ctx.locale)}</FooterLink>
						<FooterLink href="https://github.com/fluxerapp/fluxer">
							{ctx.i18n.getMessage('footer.source_code', ctx.locale)}
						</FooterLink>
						<FooterLink href="https://bsky.app/profile/fluxer.app">
							{ctx.i18n.getMessage('footer.bluesky_social_media', ctx.locale)}
						</FooterLink>
						<li>
							<div class="flex items-center gap-2">
								<a href="https://blog.fluxer.app" class={linkClass}>
									{ctx.i18n.getMessage('company_and_resources.blog', ctx.locale)}
								</a>
								<a
									href="https://blog.fluxer.app/rss/"
									title={ctx.i18n.getMessage('footer.rss_feed', ctx.locale)}
									target="_blank"
									rel="noopener noreferrer"
									class="text-white/90 transition-colors hover:text-white"
								>
									<RssIcon class="h-[1em] w-[1em]" />
								</a>
							</div>
						</li>
						<FooterLink href="https://blog.fluxer.app/roadmap-2026">
							{ctx.i18n.getMessage('footer.roadmap', ctx.locale)}
						</FooterLink>
						<FooterLink href={link('/help')}>
							{ctx.i18n.getMessage('company_and_resources.help.help_center', ctx.locale)}
						</FooterLink>
						<FooterLink href={link('/press')}>{ctx.i18n.getMessage('footer.press', ctx.locale)}</FooterLink>
						<FooterLink href="https://docs.fluxer.app">
							{ctx.i18n.getMessage('company_and_resources.docs', ctx.locale)}
						</FooterLink>
						<FooterLink href={link('/careers')}>
							{ctx.i18n.getMessage('company_and_resources.careers.label', ctx.locale)}
						</FooterLink>
					</FooterSection>

					<FooterSection title={ctx.i18n.getMessage('footer.policies', ctx.locale)}>
						<FooterLink href={link('/terms')}>{ctx.i18n.getMessage('footer.terms_of_service', ctx.locale)}</FooterLink>
						<FooterLink href={link('/privacy')}>{ctx.i18n.getMessage('footer.privacy_policy', ctx.locale)}</FooterLink>
						<FooterLink href={link('/guidelines')}>
							{ctx.i18n.getMessage('footer.community_guidelines', ctx.locale)}
						</FooterLink>
						<FooterLink href={link('/security')}>
							{ctx.i18n.getMessage('footer.security_bug_bounty', ctx.locale)}
						</FooterLink>
						<FooterLink href={link('/company-information')}>
							{ctx.i18n.getMessage('footer.company_information', ctx.locale)}
						</FooterLink>
					</FooterSection>

					<FooterSection
						title={ctx.i18n.getMessage('footer.connect', ctx.locale)}
						class="sm:col-span-1 min-[480px]:col-span-2"
					>
						<FooterLink href="mailto:press@fluxer.app">press@fluxer.app</FooterLink>
						<FooterLink href="mailto:support@fluxer.app">support@fluxer.app</FooterLink>
						<FooterLink href={link('/help/report-bug')}>
							{ctx.i18n.getMessage('footer.report_a_bug', ctx.locale)}
						</FooterLink>
					</FooterSection>
				</div>

				<div class="mt-12 pt-8">
					<p class="body-sm text-white/80">
						{ctx.i18n.getMessage('footer.fluxer_platform_ab_swedish_limited', ctx.locale)}
					</p>
				</div>
			</div>
		</footer>
	);
}
