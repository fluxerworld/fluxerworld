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

import {getFormattedLongDate} from '@fluxer/date_utils/src/DateFormatting';
import {getHelpArticle, type HelpArticle} from '@fluxer/marketing/src/help/HelpContentLoader';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderMarkdownWithBase} from '@fluxer/marketing/src/markdown/MarkdownRenderer';
import {renderContentLayout} from '@fluxer/marketing/src/pages/Layout';
import {articlePageMeta, withModifiedTime} from '@fluxer/marketing/src/pages/layout/Meta';
import {renderNotFoundPage} from '@fluxer/marketing/src/pages/NotFoundPage';
import {href} from '@fluxer/marketing/src/UrlUtils';
import type {Context} from 'hono';

const HELP_TOC_SCRIPT = `
(function () {
	var toc = document.getElementById('help-toc');
	var content = document.getElementById('help-content');
	if (!toc || !content) return;

	var navbar = document.getElementById('navbar');
	function getOffsets() {
		var navbarHeight = navbar ? navbar.offsetHeight : 100;
		return {topOffset: navbarHeight, heightOffset: navbarHeight};
	}

	var originalPosition = {top: 0, left: 0, width: 0};
	var isFixed = false;
	var ticking = false;

	function updateOriginalPosition() {
		var rect = toc.getBoundingClientRect();
		originalPosition = {
			top: window.scrollY + rect.top,
			left: rect.left,
			width: rect.width,
		};
	}

	function syncTocScroll(offset) {
		var contentRect = content.getBoundingClientRect();
		var contentTop = window.scrollY + contentRect.top;
		var contentHeight = content.offsetHeight;
		var viewportHeight = window.innerHeight;
		var scrollableDistance = contentHeight - (viewportHeight - offset);
		if (scrollableDistance <= 0) {
			toc.scrollTop = 0;
			return;
		}
		var progress = (window.scrollY + offset - contentTop) / scrollableDistance;
		var clamped = Math.min(1, Math.max(0, progress));
		var tocScroll = toc.scrollHeight - toc.clientHeight;
		if (tocScroll <= 0) {
			toc.scrollTop = 0;
			return;
		}
		toc.scrollTop = tocScroll * clamped;
	}

	function updateLayout() {
		var offsets = getOffsets();
		var topOffset = offsets.topOffset;
		var heightOffset = offsets.heightOffset;
		var scrollY = window.scrollY;

		toc.style.maxHeight = 'calc(100vh - ' + heightOffset + 'px)';
		toc.style.overflowY = 'hidden';

		var tocHeight = toc.offsetHeight;
		var contentRect = content.getBoundingClientRect();
		var contentBottom = window.scrollY + contentRect.bottom;

		var startFixing = scrollY >= originalPosition.top - topOffset;
		var maxTop = contentBottom - tocHeight - scrollY;
		var effectiveTop = Math.min(topOffset, maxTop);

		if (startFixing && !isFixed) {
			toc.style.position = 'fixed';
			toc.style.left = originalPosition.left + 'px';
			toc.style.width = originalPosition.width + 'px';
			isFixed = true;
		}

		if (isFixed) {
			toc.style.top = (effectiveTop < topOffset ? effectiveTop : topOffset) + 'px';
		}

		if (!startFixing && isFixed) {
			toc.style.position = '';
			toc.style.top = '';
			toc.style.left = '';
			toc.style.width = '';
			isFixed = false;
		}

		syncTocScroll(topOffset);
	}

	function onResize() {
		if (isFixed) {
			toc.style.position = '';
			toc.style.top = '';
			toc.style.left = '';
			toc.style.width = '';
			isFixed = false;
		}
		updateOriginalPosition();
		updateLayout();
	}

	updateOriginalPosition();

	function onScroll() {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(function () {
			ticking = false;
			updateLayout();
		});
	}

	updateLayout();
	window.addEventListener('scroll', onScroll, {passive: true});
	window.addEventListener('resize', onResize);
})();
`;

export async function renderHelpArticlePage(c: Context, ctx: MarketingContext, slug: string): Promise<Response> {
	const article = getHelpArticle(slug);

	if (!article) {
		return await renderNotFoundPage(c, ctx);
	}

	const renderedContent = renderMarkdownWithBase(
		article.content,
		ctx.baseUrl,
		ctx.appEndpoint,
		{
			allowSectionReferences: true,
		},
		ctx.i18n.getMessage('navigation.copy_link_to_section', ctx.locale),
	);
	const tocHeadings = extractHeadingsFromMarkdown(article.content);

	const content: ReadonlyArray<JSX.Element> = [renderHelpArticleBody(ctx, article, renderedContent, tocHeadings)];

	let meta = articlePageMeta(article.title, article.description);
	if (article.lastUpdated) {
		meta = withModifiedTime(meta, article.lastUpdated);
	}

	return c.html(renderContentLayout(c, ctx, meta, content, {footerClassName: 'rounded-t-3xl'}));
}

interface HeadingEntry {
	id: string;
	title: string;
	level: number;
}

function extractHeadingsFromMarkdown(markdown: string): ReadonlyArray<HeadingEntry> {
	const headings: Array<HeadingEntry> = [];
	const lines = markdown.split('\n');
	const slugCounts = new Map<string, number>();

	for (const line of lines) {
		const match = line.match(/^(#{1,6})\s+(.+?)(?:\s*\{#([^}]+)\})?\s*$/);
		if (!match) continue;

		const hashes = match[1];
		const titleRaw = match[2];
		const customId = match[3];

		if (!hashes || !titleRaw) continue;

		const level = hashes.length;
		const title = titleRaw.trim();
		const baseSlug = customId ?? createSlug(title);
		const count = (slugCounts.get(baseSlug) ?? 0) + 1;
		slugCounts.set(baseSlug, count);
		const id = count === 1 ? baseSlug : `${baseSlug}-${count}`;

		headings.push({id, title, level});
	}

	return headings;
}

function createSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function renderHelpArticleBody(
	ctx: MarketingContext,
	article: HelpArticle,
	renderedContent: string,
	tocHeadings: ReadonlyArray<HeadingEntry>,
): JSX.Element {
	return (
		<section class="mx-auto max-w-5xl">
			<div class="mb-6">
				<a href={href(ctx, '/help')} class="text-muted-foreground text-sm transition-colors hover:text-foreground">
					&larr; {ctx.i18n.getMessage('company_and_resources.help.help_center', ctx.locale)}
				</a>
			</div>
			<header class="mb-10 space-y-3">
				<div class="flex items-center gap-2">
					<span class="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600 text-xs">{article.category}</span>
				</div>
				<h1 class="font-bold text-4xl text-foreground">{article.title}</h1>
				{article.description ? <p class="text-lg text-muted-foreground">{article.description}</p> : null}
				<p class="text-muted-foreground text-sm">
					{ctx.i18n.getMessage('general.last_updated', ctx.locale)} {formatDate(article.lastUpdated, ctx.locale)}
				</p>
			</header>
			<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
				<div id="help-content" class="policy-prose" dangerouslySetInnerHTML={{__html: renderedContent}} />
				<aside id="help-toc" class="hidden lg:block">
					{renderToc(ctx.i18n.getMessage('navigation.on_this_page', ctx.locale), tocHeadings)}
				</aside>
			</div>
			<script dangerouslySetInnerHTML={{__html: HELP_TOC_SCRIPT}} />
		</section>
	);
}

function renderToc(title: string, headings: ReadonlyArray<HeadingEntry>): JSX.Element | null {
	const filtered = headings.filter((h) => h.level <= 3);
	if (filtered.length === 0) {
		return null;
	}

	const minLevel = Math.min(...filtered.map((h) => h.level));

	return (
		<nav class="space-y-2">
			<h2 class="font-semibold text-foreground text-sm">{title}</h2>
			<ul class="space-y-1 text-muted-foreground text-sm">
				{filtered.map((heading) => (
					<li style={`margin-left: ${(heading.level - minLevel) * 12}px`}>
						<a href={`#${heading.id}`} data-toc-link={heading.id} class="block py-1 hover:text-foreground">
							{heading.title}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

function formatDate(value: string, locale: string): string {
	return getFormattedLongDate(value, locale);
}
