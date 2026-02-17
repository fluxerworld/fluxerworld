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

import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderContentLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import {href} from '@fluxer/marketing/src/UrlUtils';
import type {Context} from 'hono';

export async function renderDonateSuccessPage(c: Context, ctx: MarketingContext): Promise<Response> {
	const content = [renderSuccessContent(ctx)];
	const meta = pageMeta(
		ctx.i18n.getMessage('donations.success.title', ctx.locale),
		ctx.i18n.getMessage('donations.success.description', ctx.locale),
		'website',
	);
	const html = renderContentLayout(c, ctx, meta, content, {footerClassName: 'rounded-t-3xl'});
	return c.html(html);
}

function renderSuccessContent(ctx: MarketingContext): JSX.Element {
	return (
		<section class="mx-auto max-w-2xl text-center">
			<div class="mb-8">
				<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
					<svg class="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<h1 class="mb-4 font-bold text-4xl text-foreground">
					{ctx.i18n.getMessage('donations.success.title', ctx.locale)}
				</h1>
				<p class="text-lg text-muted-foreground">{ctx.i18n.getMessage('donations.success.message', ctx.locale)}</p>
			</div>

			<div class="space-y-4">
				<p class="text-muted-foreground">{ctx.i18n.getMessage('donations.success.email_notice', ctx.locale)}</p>

				<a
					href={href(ctx, '/donate')}
					class="inline-block rounded-xl bg-[#4641D9] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#3d38c7]"
				>
					{ctx.i18n.getMessage('donations.success.back_to_donate', ctx.locale)}
				</a>
			</div>
		</section>
	);
}
