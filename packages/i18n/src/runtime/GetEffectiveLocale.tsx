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

import {hasLocaleFile} from '@fluxer/i18n/src/io/LocaleFilePath';
import type {I18nState} from '@fluxer/i18n/src/runtime/I18nTypes';

export function getEffectiveLocale<TKey extends string, TValue, TVariables>(
	state: I18nState<TKey, TValue, TVariables>,
	locale: string | null | undefined,
): string {
	if (!locale) {
		return state.config.defaultLocale;
	}

	const normalizeLocale = state.config.normalizeLocale ?? ((locale: string) => locale);
	const normalizedLocale = normalizeLocale(locale);

	if (normalizedLocale === state.config.defaultLocale) {
		return state.config.defaultLocale;
	}

	if (!hasLocaleFile(normalizedLocale, state.config.localesPath, state.config.defaultLocale)) {
		state.config.onWarning?.(`Unsupported locale, falling back to ${state.config.defaultLocale}: ${locale}`);
		return state.config.defaultLocale;
	}

	return normalizedLocale;
}
