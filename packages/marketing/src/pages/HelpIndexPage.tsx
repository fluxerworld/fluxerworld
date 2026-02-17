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

import type {HelpArticleMetadata} from '@fluxer/marketing/src/content/help/Metadata';
import {getHelpArticles} from '@fluxer/marketing/src/help/HelpContentLoader';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderContentLayout} from '@fluxer/marketing/src/pages/Layout';
import {pageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import {href} from '@fluxer/marketing/src/UrlUtils';
import type {Context} from 'hono';

const HELP_SEARCH_SCRIPT = `
(function () {
	var input = document.getElementById('help-search');
	var cards = document.querySelectorAll('[data-help-card]');
	if (!input || cards.length === 0) return;

	input.addEventListener('input', function () {
		var query = this.value.toLowerCase().trim();
		for (var i = 0; i < cards.length; i++) {
			var card = cards[i];
			var title = (card.getAttribute('data-help-title') || '').toLowerCase();
			var description = (card.getAttribute('data-help-description') || '').toLowerCase();
			var category = (card.getAttribute('data-help-category') || '').toLowerCase();
			var matches = query === '' || title.indexOf(query) !== -1 || description.indexOf(query) !== -1 || category.indexOf(query) !== -1;
			card.style.display = matches ? '' : 'none';
		}
	});
})();
`;

export async function renderHelpIndexPage(c: Context, ctx: MarketingContext): Promise<Response> {
	const articles = getHelpArticles();

	const content: ReadonlyArray<JSX.Element> = [renderHelpIndexBody(ctx, articles)];

	const meta = pageMeta(
		`Fluxer | ${ctx.i18n.getMessage('company_and_resources.help.help_center', ctx.locale)}`,
		ctx.i18n.getMessage('company_and_resources.help.help_center_description', ctx.locale),
		'website',
	);

	return c.html(renderContentLayout(c, ctx, meta, content, {footerClassName: 'rounded-t-3xl'}));
}

function renderHelpIndexBody(ctx: MarketingContext, articles: ReadonlyArray<HelpArticleMetadata>): JSX.Element {
	return (
		<section class="mx-auto max-w-5xl">
			<header class="mb-10 space-y-3">
				<h1 class="font-bold text-4xl text-foreground">
					{ctx.i18n.getMessage('company_and_resources.help.help_center', ctx.locale)}
				</h1>
				<p class="text-lg text-muted-foreground">
					{ctx.i18n.getMessage('company_and_resources.help.help_center_description', ctx.locale)}
				</p>
			</header>
			<div class="mb-8">
				<input
					id="help-search"
					type="text"
					placeholder={ctx.i18n.getMessage('company_and_resources.help.search_placeholder', ctx.locale)}
					class="help-search-input"
				/>
			</div>
			<div class="help-grid">{articles.map((article) => renderHelpCard(ctx, article))}</div>
			<script dangerouslySetInnerHTML={{__html: HELP_SEARCH_SCRIPT}} />
		</section>
	);
}

function renderHelpCard(ctx: MarketingContext, article: HelpArticleMetadata): JSX.Element {
	return (
		<a
			href={href(ctx, `/help/${article.slug}`)}
			class="help-card"
			data-help-card=""
			data-help-title={article.title}
			data-help-description={article.description}
			data-help-category={article.category}
		>
			<div class="mb-2">
				<span class="rounded-full bg-gray-100 px-2.5 py-0.5 font-medium text-gray-600 text-xs">{article.category}</span>
			</div>
			<h2 class="mb-1 font-semibold text-foreground">{article.title}</h2>
			<p class="text-muted-foreground text-sm">{article.description}</p>
		</a>
	);
}
