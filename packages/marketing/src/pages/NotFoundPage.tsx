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

import {FluxerLogoWordmarkIcon} from '@fluxer/marketing/src/components/icons/FluxerLogoWordmarkIcon';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import {href} from '@fluxer/marketing/src/UrlUtils';
import type {Context} from 'hono';

export async function renderNotFoundPage(c: Context, ctx: MarketingContext): Promise<Response> {
	const title = ctx.i18n.getMessage('navigation.page_not_found.title', ctx.locale);
	const subtitle = ctx.i18n.getMessage('navigation.page_not_found.description', ctx.locale);

	const content: ReadonlyArray<JSX.Element> = [
		<div class="h-28 shrink-0 md:h-36"></div>,
		<main class="flex flex-1 flex-col items-center justify-center px-6 pt-36 pb-12 text-center sm:px-8 md:px-12 md:pt-44 md:pb-16 lg:px-16 xl:px-20">
			<div class="mx-auto max-w-2xl">
				<div class="mb-8">
					<FluxerLogoWordmarkIcon class="mx-auto h-16 opacity-80" />
				</div>
				<div class="mb-6">
					<h1 class="hero text-white/90">404</h1>
				</div>
				<div class="mb-8">
					<h2 class="display mb-4 text-2xl text-white md:text-3xl lg:text-4xl">{title}</h2>
					<p class="body-lg text-white/80 md:text-lg">{subtitle}</p>
				</div>
				<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
					<a
						href={href(ctx, '/')}
						class="rounded-lg border border-white bg-white px-6 py-3 text-[#4641D9] transition-opacity hover:opacity-90"
					>
						{ctx.i18n.getMessage('navigation.go_home', ctx.locale)}
					</a>
					<a
						href={href(ctx, '/help')}
						class="rounded-lg border border-white/30 px-6 py-3 text-white transition-colors hover:border-white/50 hover:bg-white/10"
					>
						{ctx.i18n.getMessage('company_and_resources.help.get_help', ctx.locale)}
					</a>
				</div>
			</div>
		</main>,
		<div class="h-28 shrink-0 md:h-36"></div>,
	];

	const meta = pageMeta(
		`Fluxer | ${ctx.i18n.getMessage('navigation.page_not_found.title', ctx.locale)}`,
		subtitle,
		'website',
	);
	const html = renderLayout(c, ctx, meta, content);
	return c.html(html, 404);
}
