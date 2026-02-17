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
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {renderMarkdownWithBase} from '@fluxer/marketing/src/markdown/MarkdownRenderer';
import {renderContentLayout} from '@fluxer/marketing/src/pages/Layout';
import {articlePageMeta, withModifiedTime} from '@fluxer/marketing/src/pages/layout/Meta';
import {renderNotFoundPage} from '@fluxer/marketing/src/pages/NotFoundPage';
import {getPolicies, getPolicy, type Policy} from '@fluxer/marketing/src/policies/PolicyContentLoader';
import {href} from '@fluxer/marketing/src/UrlUtils';
import type {Context} from 'hono';

const POLICY_TOC_SCRIPT = `
(function () {
	var toc = document.getElementById('policy-toc');
	var content = document.getElementById('policy-content');
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

export async function renderPolicyPage(c: Context, ctx: MarketingContext, slug: string): Promise<Response> {
	const policy = getPolicy(slug);

	if (!policy) {
		return await renderNotFoundPage(c, ctx);
	}

	const renderedContent = renderMarkdownWithBase(
		policy.content,
		ctx.baseUrl,
		ctx.appEndpoint,
		{
			allowSectionReferences: true,
		},
		ctx.i18n.getMessage('navigation.copy_link_to_section', ctx.locale),
	);
	const tocHeadings = extractHeadingsFromMarkdown(policy.content);
	const readingTime = estimateReadingTime(policy.content);
	const related = collectRelatedPolicies(policy);

	const content: ReadonlyArray<JSX.Element> = [
		renderPolicyBody(ctx, policy, renderedContent, tocHeadings, readingTime, related),
	];

	let meta = articlePageMeta(policy.title, policy.description);
	if (policy.lastUpdated) {
		meta = withModifiedTime(meta, policy.lastUpdated);
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

function estimateReadingTime(markdown: string): number {
	const words = markdown.split(/\s+/).filter((word) => word.length > 0).length;
	return Math.max(1, Math.ceil(words / 200));
}

function renderPolicyBody(
	ctx: MarketingContext,
	policy: Policy,
	renderedContent: string,
	tocHeadings: ReadonlyArray<HeadingEntry>,
	_readingTime: number,
	related: ReadonlyArray<Policy>,
): JSX.Element {
	return (
		<section class="mx-auto max-w-5xl">
			<header class="mb-10 space-y-3">
				<h1 class="font-bold text-4xl text-foreground">{policy.title}</h1>
				{policy.description ? <p class="text-lg text-muted-foreground">{policy.description}</p> : null}
				<p class="text-muted-foreground text-sm">
					{ctx.i18n.getMessage('general.last_updated', ctx.locale)} {formatDate(policy.lastUpdated, ctx.locale)}
				</p>
			</header>
			<div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
				<div id="policy-content" class="policy-prose" dangerouslySetInnerHTML={{__html: renderedContent}} />
				<aside id="policy-toc" class="hidden lg:block">
					{renderToc(ctx.i18n.getMessage('navigation.on_this_page', ctx.locale), tocHeadings)}
				</aside>
			</div>
			<script dangerouslySetInnerHTML={{__html: POLICY_TOC_SCRIPT}} />
			{related.length > 0 ? (
				<div class="mt-12 border-gray-200/60 border-t pt-8">
					<h2 class="mb-4 font-semibold text-foreground text-lg">
						{ctx.i18n.getMessage('misc_labels.related_policies', ctx.locale)}
					</h2>
					<div class="grid gap-3 md:grid-cols-2">{related.map((entry) => renderRelatedPolicy(ctx, entry))}</div>
				</div>
			) : null}
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

function renderRelatedPolicy(ctx: MarketingContext, policy: Policy): JSX.Element {
	const url = href(ctx, `/${policy.slug}`);
	return (
		<a href={url} class="group block py-2 text-muted-foreground text-sm hover:text-foreground">
			<div class="font-medium text-foreground group-hover:text-primary">{policy.title}</div>
			{policy.description ? <div class="mt-0.5 text-muted-foreground text-sm">{policy.description}</div> : null}
		</a>
	);
}

function formatDate(value: string, locale: string): string {
	return getFormattedLongDate(value, locale);
}

function collectRelatedPolicies(policy: Policy): ReadonlyArray<Policy> {
	const allPolicies = getPolicies();
	const others = allPolicies.filter((entry) => entry.slug !== policy.slug);
	if (others.length === 0) return [];

	const result: Array<Policy> = [];
	for (const metadata of others) {
		const loaded = getPolicy(metadata.slug);
		if (loaded) {
			result.push(loaded);
		}
	}

	const sameCategory = policy.category ? result.filter((entry) => entry.category === policy.category) : [];
	const fallback = result.filter((entry) => entry.category !== policy.category);
	return [...sameCategory, ...fallback].slice(0, 4);
}
