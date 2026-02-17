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

import {getMarketingMessage, hasMarketingLocale} from '@fluxer/marketing/src/marketing_i18n/MarketingI18n';
import type {MarketingI18nKey} from '@fluxer/marketing/src/marketing_i18n/MarketingI18nTypes.generated';

export class MarketingI18nService {
	getMessage(key: MarketingI18nKey, locale: string | null): string;
	getMessage(key: MarketingI18nKey, locale: string | null, variables: ReadonlyArray<unknown>): string;
	getMessage(key: MarketingI18nKey, locale: string | null, variables: Record<string, unknown>): string;
	getMessage(
		key: MarketingI18nKey,
		locale: string | null,
		variables?: Record<string, unknown> | ReadonlyArray<unknown>,
	): string {
		return getMarketingMessage(key, locale, variables);
	}

	hasLocale(locale: string): boolean {
		return hasMarketingLocale(locale);
	}
}
