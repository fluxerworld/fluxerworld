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
import {createI18n} from '@fluxer/marketing/src/I18n';
import type {MarketingConfig} from '@fluxer/marketing/src/MarketingConfig';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {getMarketingRequestInfo} from '@fluxer/marketing/src/MarketingTelemetry';
import {getMarketingCsrfToken} from '@fluxer/marketing/src/middleware/Csrf';
import {normalizeBasePath} from '@fluxer/marketing/src/UrlUtils';
import type {Context as HonoContext} from 'hono';

export interface CreateMarketingContextFactoryOptions {
	config: MarketingConfig;
	publicDir: string;
}

export type MarketingContextFactory = (c: HonoContext) => Promise<MarketingContext>;

export function createMarketingContextFactory(options: CreateMarketingContextFactoryOptions): MarketingContextFactory {
	const i18n = createI18n();
	const basePath = normalizeBasePath(options.config.basePath);
	const baseUrl = buildMarketingBaseUrl(options.config.marketingEndpoint, basePath);

	return async function buildContext(c: HonoContext): Promise<MarketingContext> {
		const requestInfo = await getMarketingRequestInfo(c, options.config);
		const csrfToken = getMarketingCsrfToken(c);

		return {
			locale: requestInfo.locale,
			i18n,
			staticDirectory: `${options.publicDir}/static`,
			baseUrl,
			countryCode: requestInfo.countryCode,
			apiEndpoint: options.config.apiEndpoint,
			appEndpoint: options.config.appEndpoint,
			staticCdnEndpoint: CdnEndpoints.STATIC,
			assetVersion: options.config.buildTimestamp,
			basePath,
			platform: requestInfo.platform,
			architecture: requestInfo.architecture,
			releaseChannel: options.config.releaseChannel,
			csrfToken,
			isDev: options.config.env === 'development',
		};
	};
}

function buildMarketingBaseUrl(marketingEndpoint: string, basePath: string): string {
	const trimmedEndpoint = marketingEndpoint.endsWith('/') ? marketingEndpoint.slice(0, -1) : marketingEndpoint;
	if (!basePath) return trimmedEndpoint;
	if (trimmedEndpoint.endsWith(basePath)) return trimmedEndpoint;
	return `${trimmedEndpoint}${basePath}`;
}
