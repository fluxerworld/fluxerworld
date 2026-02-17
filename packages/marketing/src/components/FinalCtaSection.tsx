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

import {renderSecondaryButton, renderWithOverlay} from '@fluxer/marketing/src/components/PlatformDownloadButton';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {GRADIENTS} from '@fluxer/ui/src/styles/Gradients';
import {SPACING} from '@fluxer/ui/src/styles/Spacing';

interface FinalCtaSectionProps {
	ctx: MarketingContext;
}

export function FinalCtaSection(props: FinalCtaSectionProps): JSX.Element {
	const {ctx} = props;

	return (
		<section class={GRADIENTS.light}>
			<div class={`${GRADIENTS.cta} rounded-t-3xl`}>
				<div class={`${SPACING.large} text-center lg:py-40`}>
					<h2 class="display mb-8 font-bold text-5xl text-white md:mb-10 md:text-6xl lg:text-7xl">
						{ctx.i18n.getMessage('misc_labels.ready_to_get_started', ctx.locale)}
					</h2>
					<p class="lead mx-auto mb-12 max-w-3xl text-white/90 text-xl md:mb-14 md:text-2xl">
						{ctx.i18n.getMessage('download.download_app_or_open_in_browser', ctx.locale)}
					</p>
					<div class="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-stretch">
						{renderWithOverlay(ctx, 'cta')}
						{renderSecondaryButton(
							ctx,
							`${ctx.appEndpoint}/channels/@me`,
							ctx.i18n.getMessage('download.open_in_browser', ctx.locale),
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
