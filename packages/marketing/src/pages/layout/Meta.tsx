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

export interface PageMeta {
	title: string;
	description: string;
	ogType: string;
	ogImageUrl: string | null;
	publishedTime: string | null;
	modifiedTime: string | null;
}

export function defaultPageMeta(): PageMeta {
	return {
		title: 'Fluxer: A chat app that puts you first',
		description:
			'Fluxer is a free and open source instant messaging and VoIP platform built for friends, groups, and communities.',
		ogType: 'website',
		ogImageUrl: null,
		publishedTime: null,
		modifiedTime: null,
	};
}

export function pageMeta(title: string, description: string, ogType: string): PageMeta {
	return {
		title,
		description,
		ogType,
		ogImageUrl: null,
		publishedTime: null,
		modifiedTime: null,
	};
}

export function articlePageMeta(title: string, description: string): PageMeta {
	return {
		title: `Fluxer | ${title}`,
		description,
		ogType: 'article',
		ogImageUrl: null,
		publishedTime: null,
		modifiedTime: null,
	};
}

export function withOgImage(meta: PageMeta, url: string): PageMeta {
	return {...meta, ogImageUrl: url};
}

export function withPublishedTime(meta: PageMeta, isoDatetime: string): PageMeta {
	return {...meta, publishedTime: isoDatetime};
}

export function withModifiedTime(meta: PageMeta, isoDatetime: string): PageMeta {
	return {...meta, modifiedTime: isoDatetime};
}

export function formatPageTitle(baseTitle: string): string {
	if (baseTitle === 'Fluxer') return 'Fluxer';
	return `Fluxer | ${baseTitle}`;
}

export function buildMetaTags(ctx: MarketingContext, meta: PageMeta, pageUrl: string): ReadonlyArray<JSX.Element> {
	const defaultOgImageUrl = `${ctx.staticCdnEndpoint}/web/og-image-default.png`;
	const ogImageUrl = meta.ogImageUrl ?? defaultOgImageUrl;
	const ogLocale = getOgLocale(ctx);

	return [
		<meta name="description" content={meta.description} />,
		<meta property="og:site_name" content="Fluxer" />,
		<meta property="og:locale" content={ogLocale} />,
		<meta property="og:title" content={meta.title} />,
		<meta property="og:description" content={meta.description} />,
		<meta property="og:image" content={ogImageUrl} />,
		<meta property="og:url" content={pageUrl} />,
		<meta property="og:type" content={meta.ogType} />,
		<meta name="twitter:card" content="summary_large_image" />,
		<meta name="twitter:title" content={meta.title} />,
		<meta name="twitter:description" content={meta.description} />,
		<meta name="twitter:image" content={ogImageUrl} />,
		<meta name="robots" content="index,follow" />,
		<meta name="theme-color" content="#4641D9" />,
		<meta name="author" content="Fluxer Team" />,
		<link rel="canonical" href={pageUrl} />,
		<link
			rel="alternate"
			type="application/rss+xml"
			title={ctx.i18n.getMessage('social_and_feeds.rss.fluxer_blog_rss', ctx.locale)}
			href="https://blog.fluxer.app/rss/"
		/>,
		...articleTimeMeta(meta),
	];
}

function getOgLocale(ctx: MarketingContext): string {
	const code = ctx.locale;
	const parts = code.split('-');
	if (parts.length === 2 && parts[0] && parts[1]) {
		return `${parts[0]}_${parts[1].toUpperCase()}`;
	}
	return code.replace('-', '_');
}

function articleTimeMeta(meta: PageMeta): ReadonlyArray<JSX.Element> {
	const tags: Array<JSX.Element> = [];
	if (meta.publishedTime) {
		tags.push(<meta property="article:published_time" content={meta.publishedTime} />);
	}
	if (meta.modifiedTime) {
		tags.push(<meta property="article:modified_time" content={meta.modifiedTime} />);
		tags.push(<meta property="og:updated_time" content={meta.modifiedTime} />);
	}
	return tags;
}
