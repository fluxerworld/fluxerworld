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

import {Footer} from '@fluxer/marketing/src/components/Footer';
import {LocaleSelectorModal} from '@fluxer/marketing/src/components/LocaleSelector';
import {Navigation} from '@fluxer/marketing/src/components/Navigation';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {getCurrentPath} from '@fluxer/marketing/src/PathUtils';
import {buildIconLinks} from '@fluxer/marketing/src/pages/layout/Icons';
import type {PageMeta} from '@fluxer/marketing/src/pages/layout/Meta';
import {buildMetaTags} from '@fluxer/marketing/src/pages/layout/Meta';
import {docsPageScript, downloadScript, mainPageScript} from '@fluxer/marketing/src/pages/layout/Scripts';
import {cacheBustedAsset} from '@fluxer/marketing/src/UrlUtils';
import type {Context} from 'hono';

export function renderLayout(
	req: Context,
	ctx: MarketingContext,
	pageMeta: PageMeta,
	content: ReadonlyArray<JSX.Element>,
): JSX.Element {
	const currentPath = getCurrentPath(getPathWithinBasePath(req.req.path, ctx.basePath));
	const pageUrl = currentPath === '/' ? ctx.baseUrl : `${ctx.baseUrl}${currentPath}`;

	return (
		<html lang={ctx.locale}>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				{buildMetaTags(ctx, pageMeta, pageUrl)}
				<title>{pageMeta.title}</title>
				<link rel="preconnect" href="https://fluxerstatic.com" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/ibm-plex.css" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/bricolage.css" />
				<link rel="stylesheet" href={cacheBustedAsset(ctx, '/static/app.css')} />
				{buildIconLinks(ctx.staticCdnEndpoint)}
				{mainPageScript()}
				{downloadScript()}
			</head>
			<body class="flex min-h-screen flex-col bg-[#4641D9] font-sans text-white">
				<Navigation ctx={ctx} request={req} />
				<div class="flex grow flex-col">{content}</div>
				<Footer ctx={ctx} />
				<LocaleSelectorModal ctx={ctx} currentPath={currentPath} />
			</body>
		</html>
	);
}

export function renderDocsLayout(
	req: Context,
	ctx: MarketingContext,
	pageMeta: PageMeta,
	pageTitle: string,
	content: ReadonlyArray<JSX.Element>,
): JSX.Element {
	const currentPath = getCurrentPath(getPathWithinBasePath(req.req.path, ctx.basePath));
	const pageUrl = currentPath === '/' ? ctx.baseUrl : `${ctx.baseUrl}${currentPath}`;

	return (
		<html lang={ctx.locale}>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				{buildMetaTags(ctx, pageMeta, pageUrl)}
				<title>{pageMeta.title}</title>
				<link rel="preconnect" href="https://fluxerstatic.com" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/ibm-plex.css" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/bricolage.css" />
				<link rel="stylesheet" href={cacheBustedAsset(ctx, '/static/app.css')} />
				{buildIconLinks(ctx.staticCdnEndpoint)}
				{docsPageScript()}
			</head>
			<body class="bg-white">
				<Navigation ctx={ctx} request={req} />
				<main class="min-h-screen bg-white px-6 pt-48 pb-16 sm:px-8 md:px-12 md:pt-60 lg:px-16 xl:px-20">
					<article class="prose prose-lg prose-gray mx-auto max-w-4xl">
						<h1 class="mb-2 font-bold text-4xl">{pageTitle}</h1>
						{content}
					</article>
				</main>
				<Footer ctx={ctx} />
				<LocaleSelectorModal ctx={ctx} currentPath={currentPath} />
			</body>
		</html>
	);
}

export function renderBlogLayout(
	req: Context,
	ctx: MarketingContext,
	pageMeta: PageMeta,
	pageTitle: string,
	content: ReadonlyArray<JSX.Element>,
): JSX.Element {
	const currentPath = getCurrentPath(getPathWithinBasePath(req.req.path, ctx.basePath));
	const pageUrl = currentPath === '/' ? ctx.baseUrl : `${ctx.baseUrl}${currentPath}`;

	return (
		<html lang={ctx.locale}>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				{buildMetaTags(ctx, pageMeta, pageUrl)}
				<title>{pageMeta.title}</title>
				<link rel="preconnect" href="https://fluxerstatic.com" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/ibm-plex.css" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/bricolage.css" />
				<link rel="stylesheet" href={cacheBustedAsset(ctx, '/static/app.css')} />
				{buildIconLinks(ctx.staticCdnEndpoint)}
				{docsPageScript()}
			</head>
			<body class="bg-white">
				<Navigation ctx={ctx} request={req} />
				<main class="min-h-screen bg-white px-6 pt-48 pb-16 sm:px-8 md:px-12 md:pt-60 lg:px-16 xl:px-20">
					<div class="mx-auto max-w-6xl">
						<h1 class="mb-8 font-bold text-4xl text-foreground">{pageTitle}</h1>
						{content}
					</div>
				</main>
				<Footer ctx={ctx} />
				<LocaleSelectorModal ctx={ctx} currentPath={currentPath} />
			</body>
		</html>
	);
}

export function renderBlogPostLayout(
	req: Context,
	ctx: MarketingContext,
	pageMeta: PageMeta,
	content: ReadonlyArray<JSX.Element>,
): JSX.Element {
	const currentPath = getCurrentPath(getPathWithinBasePath(req.req.path, ctx.basePath));
	const pageUrl = currentPath === '/' ? ctx.baseUrl : `${ctx.baseUrl}${currentPath}`;

	return (
		<html lang={ctx.locale}>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				{buildMetaTags(ctx, pageMeta, pageUrl)}
				<title>{pageMeta.title}</title>
				<link rel="preconnect" href="https://fluxerstatic.com" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/ibm-plex.css" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/bricolage.css" />
				<link rel="stylesheet" href={cacheBustedAsset(ctx, '/static/app.css')} />
				{buildIconLinks(ctx.staticCdnEndpoint)}
				{docsPageScript()}
			</head>
			<body class="bg-white">
				<Navigation ctx={ctx} request={req} />
				<main class="min-h-screen bg-white px-6 pt-48 pb-16 sm:px-8 md:px-12 md:pt-60 lg:px-16 xl:px-20">
					<div class="mx-auto max-w-6xl">{content}</div>
				</main>
				<Footer ctx={ctx} />
				<LocaleSelectorModal ctx={ctx} currentPath={currentPath} />
			</body>
		</html>
	);
}

interface ContentLayoutOptions {
	footerClassName?: string;
}

export function renderContentLayout(
	req: Context,
	ctx: MarketingContext,
	pageMeta: PageMeta,
	content: ReadonlyArray<JSX.Element>,
	options: ContentLayoutOptions = {},
): JSX.Element {
	const currentPath = getCurrentPath(getPathWithinBasePath(req.req.path, ctx.basePath));
	const pageUrl = currentPath === '/' ? ctx.baseUrl : `${ctx.baseUrl}${currentPath}`;
	const {footerClassName = ''} = options;

	return (
		<html lang={ctx.locale}>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				{buildMetaTags(ctx, pageMeta, pageUrl)}
				<title>{pageMeta.title}</title>
				<link rel="preconnect" href="https://fluxerstatic.com" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/ibm-plex.css" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/bricolage.css" />
				<link rel="stylesheet" href={cacheBustedAsset(ctx, '/static/app.css')} />
				{buildIconLinks(ctx.staticCdnEndpoint)}
				{docsPageScript()}
			</head>
			<body class="bg-white">
				<Navigation ctx={ctx} request={req} />
				<main class="min-h-screen bg-white px-6 pt-48 pb-16 sm:px-8 md:px-12 md:pt-60 lg:px-16 xl:px-20">
					{content}
				</main>
				<Footer ctx={ctx} className={footerClassName} />
				<LocaleSelectorModal ctx={ctx} currentPath={currentPath} />
			</body>
		</html>
	);
}

function getPathWithinBasePath(path: string, basePath: string): string {
	const normalizedPath = getCurrentPath(path);
	if (!basePath) return normalizedPath;
	if (normalizedPath === basePath) return '';
	if (normalizedPath.startsWith(`${basePath}/`)) return normalizedPath.slice(basePath.length);
	return normalizedPath;
}
