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

type LayoutScriptMode = 'main' | 'docs';

export interface RenderMarketingDocumentOptions {
	request: Context;
	ctx: MarketingContext;
	pageMeta: PageMeta;
	bodyClassName: string;
	content: JSX.Element;
	scriptMode: LayoutScriptMode;
	footerClassName?: string;
}

export function renderMarketingDocument(options: RenderMarketingDocumentOptions): JSX.Element {
	const currentPath = getCurrentPath(getPathWithinBasePath(options.request.req.path, options.ctx.basePath));
	const pageUrl = currentPath === '/' ? options.ctx.baseUrl : `${options.ctx.baseUrl}${currentPath}`;

	return (
		<html lang={options.ctx.locale}>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				{buildMetaTags(options.ctx, options.pageMeta, pageUrl)}
				<title>{options.pageMeta.title}</title>
				<link rel="preconnect" href="https://fluxerstatic.com" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/ibm-plex.css" />
				<link rel="stylesheet" href="https://fluxerstatic.com/fonts/bricolage.css" />
				<link rel="stylesheet" href={cacheBustedAsset(options.ctx, '/static/app.css')} />
				{buildIconLinks(options.ctx.staticCdnEndpoint)}
				{resolveLayoutScripts(options.scriptMode)}
			</head>
			<body class={options.bodyClassName}>
				<Navigation ctx={options.ctx} request={options.request} />
				{options.content}
				<Footer ctx={options.ctx} className={options.footerClassName} />
				<LocaleSelectorModal ctx={options.ctx} currentPath={currentPath} />
			</body>
		</html>
	);
}

function resolveLayoutScripts(scriptMode: LayoutScriptMode): ReadonlyArray<JSX.Element> {
	if (scriptMode === 'main') {
		return [mainPageScript(), downloadScript()];
	}
	return [docsPageScript()];
}

function getPathWithinBasePath(path: string, basePath: string): string {
	const normalizedPath = getCurrentPath(path);
	if (!basePath) return normalizedPath;
	if (normalizedPath === basePath) return '';
	if (normalizedPath.startsWith(`${basePath}/`)) return normalizedPath.slice(basePath.length);
	return normalizedPath;
}
