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

import type {LocaleCode} from '@fluxer/constants/src/Locales';
import type {MarketingI18nService} from '@fluxer/marketing/src/marketing_i18n/MarketingI18nService';

export type MarketingPlatform = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';
export type MarketingArchitecture = 'x64' | 'arm64' | 'unknown';
export interface MarketingContext {
	locale: LocaleCode;
	i18n: MarketingI18nService;
	staticDirectory: string;
	baseUrl: string;
	countryCode: string;
	apiEndpoint: string;
	appEndpoint: string;
	staticCdnEndpoint: string;
	assetVersion: string;
	basePath: string;
	platform: MarketingPlatform;
	architecture: MarketingArchitecture;
	releaseChannel: string;
	csrfToken: string;
	isDev: boolean;
}
