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

import type {LocaleCode} from '@fluxer/constants/src/Locales';
import {
	getLocaleByCode,
	getLocaleDisplayName,
	getLocaleFlagCode,
	getLocaleLanguageCode,
} from '@fluxer/locale/src/catalog/LocaleCatalog';
import {resolveLocaleFromAcceptLanguageHeader} from '@fluxer/locale/src/resolution/AcceptLanguageNegotiation';

export interface LocaleMetadata {
	code: LocaleCode;
	languageCode: string;
	name: string;
	flagCode: string;
}

export function getLocaleMetadata(locale: LocaleCode): LocaleMetadata {
	return {
		code: locale,
		languageCode: getLocaleLanguageCode(locale),
		name: getLocaleDisplayName(locale),
		flagCode: getLocaleFlagCode(locale),
	};
}

export function getLocaleName(locale: LocaleCode): string {
	return getLocaleDisplayName(locale);
}

export function getFlagCode(locale: LocaleCode): string {
	return getLocaleFlagCode(locale);
}

export function getLocaleFromCode(code: string): LocaleCode | null {
	return getLocaleByCode(code);
}

export function getLocaleCode(locale: LocaleCode): string {
	return getLocaleLanguageCode(locale);
}

export function parseAcceptLanguage(acceptLanguageHeader: string | null | undefined): LocaleCode {
	return resolveLocaleFromAcceptLanguageHeader(acceptLanguageHeader);
}
