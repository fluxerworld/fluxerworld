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

import {CdnEndpoints} from '@fluxer/constants/src/CdnEndpoints';
import {Headers, HeaderValues} from '@fluxer/constants/src/Headers';
import {HttpStatus, MimeType} from '@fluxer/constants/src/HttpConstants';
import {isPressAssetId, PressAssets} from '@fluxer/constants/src/PressAssets';
import {createSession} from '@fluxer/hono/src/Session';
import {getLocaleFromCode} from '@fluxer/locale/src/LocaleService';
import type {MarketingConfig} from '@fluxer/marketing/src/MarketingConfig';
import {sendMarketingRequest} from '@fluxer/marketing/src/MarketingHttpClient';
import {renderCareersPage} from '@fluxer/marketing/src/pages/CareersPage';
import {renderDonateManagePage} from '@fluxer/marketing/src/pages/DonateManagePage';
import {renderDonatePage} from '@fluxer/marketing/src/pages/DonatePage';
import {renderDonateSuccessPage} from '@fluxer/marketing/src/pages/DonateSuccessPage';
import {renderDownloadPage} from '@fluxer/marketing/src/pages/DownloadPage';
import {renderHelpArticlePage} from '@fluxer/marketing/src/pages/HelpArticlePage';
import {renderHelpIndexPage} from '@fluxer/marketing/src/pages/HelpIndexPage';
import {renderHomePage} from '@fluxer/marketing/src/pages/HomePage';
import {renderNotFoundPage} from '@fluxer/marketing/src/pages/NotFoundPage';
import {renderPartnersPage} from '@fluxer/marketing/src/pages/PartnersPage';
import {renderPlutoniumPage} from '@fluxer/marketing/src/pages/PlutoniumPage';
import {renderPolicyPage} from '@fluxer/marketing/src/pages/PolicyPage';
import {renderPressPage} from '@fluxer/marketing/src/pages/PressPage';
import {sanitizeInternalRedirectPath} from '@fluxer/marketing/src/RedirectPathUtils';
import type {MarketingRouteHandler} from '@fluxer/marketing/src/routes/RouteTypes';
import {generateSitemap} from '@fluxer/marketing/src/Sitemap';
import {prependBasePath} from '@fluxer/marketing/src/UrlUtils';
import type {Hono} from 'hono';
import {setCookie} from 'hono/cookie';
import type {MarketingContextFactory} from './MarketingContextFactory';

export interface RegisterMarketingRoutesOptions {
	app: Hono;
	config: MarketingConfig;
	contextFactory: MarketingContextFactory;
}

interface LocaleCookieSession {
	locale: string;
}

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const POLICY_ROUTE_DEFINITIONS = [
	{path: '/terms', slug: 'terms'},
	{path: '/privacy', slug: 'privacy'},
	{path: '/security', slug: 'security'},
	{path: '/guidelines', slug: 'guidelines'},
	{path: '/company-information', slug: 'company-information'},
] as const;

const PAGE_ROUTE_DEFINITIONS: ReadonlyArray<{
	path: string;
	handler: MarketingRouteHandler;
}> = [
	{path: '/', handler: renderHomePage},
	{path: '/careers', handler: renderCareersPage},
	{path: '/download', handler: renderDownloadPage},
	{path: '/donate', handler: renderDonatePage},
	{path: '/donate/manage', handler: renderDonateManagePage},
	{path: '/donate/success', handler: renderDonateSuccessPage},
	{path: '/plutonium', handler: renderPlutoniumPage},
	{path: '/partners', handler: renderPartnersPage},
	{path: '/press', handler: renderPressPage},
];

export function registerMarketingRoutes(options: RegisterMarketingRoutesOptions): void {
	registerLocaleRoute(options.app, options.config);
	registerExternalRedirects(options.app);
	registerSystemContentRoutes(options.app, options.contextFactory);
	registerHelpRoutes(options.app, options.contextFactory);
	registerPolicyRoutes(options.app, options.contextFactory);
	registerPageRoutes(options.app, options.contextFactory);
	registerPressDownloadRoute(options.app);
	registerNotFoundRoute(options.app, options.contextFactory);
}

function registerLocaleRoute(app: Hono, config: MarketingConfig): void {
	app.post('/_locale', async (c) => {
		const body = await c.req.parseBody();
		const localeCode = typeof body['locale'] === 'string' ? body['locale'] : '';
		const redirectPath = sanitizeInternalRedirectPath(typeof body['redirect'] === 'string' ? body['redirect'] : '/');
		const locale = getLocaleFromCode(localeCode);
		if (!locale) return c.text('Bad Request', HttpStatus.BAD_REQUEST);

		const cookieValue = createLocaleCookieValue(locale, config.secretKeyBase);
		setCookie(c, 'locale', cookieValue, {path: '/', maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS});
		return c.redirect(prependBasePath(config.basePath, redirectPath), HttpStatus.FOUND);
	});
}

function registerExternalRedirects(app: Hono): void {
	app.get('/get/livekitctl', (c) => {
		return c.redirect(
			'https://raw.githubusercontent.com/fluxerapp/fluxer/main/fluxer_devops/livekitctl/scripts/install.sh',
			HttpStatus.FOUND,
		);
	});

	app.get('/regional-restrictions', (c) => c.redirect('/help/regional-restrictions', HttpStatus.MOVED_PERMANENTLY));
	app.get('/blog', (c) => c.redirect('https://blog.fluxer.app', HttpStatus.FOUND));
	app.get('/blog/*', (c) => c.redirect('https://blog.fluxer.app', HttpStatus.FOUND));
}

function registerSystemContentRoutes(app: Hono, contextFactory: MarketingContextFactory): void {
	app.get('/_health', (c) => c.json({status: 'ok'}));

	app.get('/robots.txt', (c) => {
		return c.text('User-agent: *\nAllow: /\n');
	});

	registerContextRoute(app, '/security.txt', contextFactory, (_c, ctx) => {
		const securityUrl = `${ctx.baseUrl}/security`;
		const expires = `${new Date().getUTCFullYear() + 1}-01-05T13:37:00.000Z`;
		const body = [
			`Contact: ${securityUrl}`,
			'Contact: mailto:security@fluxer.app',
			`Expires: ${expires}`,
			'Preferred-Languages: en',
			`Policy: ${securityUrl}`,
		].join('\n');
		return _c.text(`${body}\n`);
	});

	registerContextRoute(app, '/sitemap.xml', contextFactory, (c, ctx) => {
		const xml = generateSitemap(ctx.baseUrl);
		c.header(Headers.CONTENT_TYPE, `${MimeType.XML}; charset=utf-8`);
		return c.text(xml);
	});
}

function registerHelpRoutes(app: Hono, contextFactory: MarketingContextFactory): void {
	registerContextRoute(app, '/help', contextFactory, async (c, ctx) => {
		return await renderHelpIndexPage(c, ctx);
	});

	registerContextRoute(app, '/help/:slug', contextFactory, async (c, ctx) => {
		const slug = c.req.param('slug');
		return await renderHelpArticlePage(c, ctx, slug);
	});
}

function registerPolicyRoutes(app: Hono, contextFactory: MarketingContextFactory): void {
	for (const route of POLICY_ROUTE_DEFINITIONS) {
		registerContextRoute(app, route.path, contextFactory, async (c, ctx) => {
			return await renderPolicyPage(c, ctx, route.slug);
		});
	}
}

function registerPageRoutes(app: Hono, contextFactory: MarketingContextFactory): void {
	for (const route of PAGE_ROUTE_DEFINITIONS) {
		registerContextRoute(app, route.path, contextFactory, async (c, ctx) => {
			return await route.handler(c, ctx);
		});
	}
}

function registerPressDownloadRoute(app: Hono): void {
	app.get('/press/download/:assetId', async (c) => {
		const assetId = c.req.param('assetId');
		if (!isPressAssetId(assetId)) {
			return c.text('', HttpStatus.NOT_FOUND);
		}

		const asset = PressAssets[assetId];
		const response = await sendMarketingRequest({
			url: `${CdnEndpoints.STATIC}${asset.path}`,
			method: 'GET',
			serviceName: 'marketing_press_download',
		});
		if (response.status < 200 || response.status >= 300 || !response.stream) {
			return c.text('', HttpStatus.NOT_FOUND);
		}

		const contentType = response.headers.get(Headers.CONTENT_TYPE);
		if (contentType) {
			c.header(Headers.CONTENT_TYPE, contentType);
		} else {
			c.header(Headers.CONTENT_TYPE, MimeType.OCTET_STREAM);
		}

		const contentLength = response.headers.get(Headers.CONTENT_LENGTH);
		if (contentLength) {
			c.header(Headers.CONTENT_LENGTH, contentLength);
		}

		const cacheControl = response.headers.get(Headers.CACHE_CONTROL);
		if (cacheControl) {
			c.header(Headers.CACHE_CONTROL, cacheControl);
		}

		c.header(Headers.CONTENT_DISPOSITION, `${HeaderValues.ATTACHMENT}; filename="${asset.filename}"`);
		return c.body(response.stream, HttpStatus.OK);
	});
}

function registerNotFoundRoute(app: Hono, contextFactory: MarketingContextFactory): void {
	registerContextRoute(app, '*', contextFactory, async (c, ctx) => {
		return await renderNotFoundPage(c, ctx);
	});
}

function registerContextRoute(
	app: Hono,
	path: string,
	contextFactory: MarketingContextFactory,
	handler: MarketingRouteHandler,
): void {
	app.get(path, async (c) => {
		const ctx = await contextFactory(c);
		return await handler(c, ctx);
	});
}

function createLocaleCookieValue(locale: string, secretKeyBase: string): string {
	return createSession<LocaleCookieSession>({locale}, secretKeyBase);
}
