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

import AppStorage from '@app/lib/AppStorage';
import {Logger} from '@app/lib/Logger';
import {getNativeLocaleIdentifier} from '@app/lib/Platform';
import {messages as messagesAr} from '@app/locales/ar/messages.mjs';
import {messages as messagesBg} from '@app/locales/bg/messages.mjs';
import {messages as messagesCs} from '@app/locales/cs/messages.mjs';
import {messages as messagesDa} from '@app/locales/da/messages.mjs';
import {messages as messagesDe} from '@app/locales/de/messages.mjs';
import {messages as messagesEl} from '@app/locales/el/messages.mjs';
import {messages as messagesEnGB} from '@app/locales/en-GB/messages.mjs';
import {messages as messagesEnUS} from '@app/locales/en-US/messages.mjs';
import {messages as messagesEs419} from '@app/locales/es-419/messages.mjs';
import {messages as messagesEsES} from '@app/locales/es-ES/messages.mjs';
import {messages as messagesFi} from '@app/locales/fi/messages.mjs';
import {messages as messagesFr} from '@app/locales/fr/messages.mjs';
import {messages as messagesHe} from '@app/locales/he/messages.mjs';
import {messages as messagesHi} from '@app/locales/hi/messages.mjs';
import {messages as messagesHr} from '@app/locales/hr/messages.mjs';
import {messages as messagesHu} from '@app/locales/hu/messages.mjs';
import {messages as messagesId} from '@app/locales/id/messages.mjs';
import {messages as messagesIt} from '@app/locales/it/messages.mjs';
import {messages as messagesJa} from '@app/locales/ja/messages.mjs';
import {messages as messagesKo} from '@app/locales/ko/messages.mjs';
import {messages as messagesLt} from '@app/locales/lt/messages.mjs';
import {messages as messagesNl} from '@app/locales/nl/messages.mjs';
import {messages as messagesNo} from '@app/locales/no/messages.mjs';
import {messages as messagesPl} from '@app/locales/pl/messages.mjs';
import {messages as messagesPtBR} from '@app/locales/pt-BR/messages.mjs';
import {messages as messagesRo} from '@app/locales/ro/messages.mjs';
import {messages as messagesRu} from '@app/locales/ru/messages.mjs';
import {messages as messagesSvSE} from '@app/locales/sv-SE/messages.mjs';
import {messages as messagesTh} from '@app/locales/th/messages.mjs';
import {messages as messagesTr} from '@app/locales/tr/messages.mjs';
import {messages as messagesUk} from '@app/locales/uk/messages.mjs';
import {messages as messagesVi} from '@app/locales/vi/messages.mjs';
import {messages as messagesZhCN} from '@app/locales/zh-CN/messages.mjs';
import {messages as messagesZhTW} from '@app/locales/zh-TW/messages.mjs';
import {i18n, type Messages} from '@lingui/core';

const supportedLocales = [
	'ar',
	'bg',
	'cs',
	'da',
	'de',
	'el',
	'en-GB',
	'en-US',
	'es-ES',
	'es-419',
	'fi',
	'fr',
	'he',
	'hi',
	'hr',
	'hu',
	'id',
	'it',
	'ja',
	'ko',
	'lt',
	'nl',
	'no',
	'pl',
	'pt-BR',
	'ro',
	'ru',
	'sv-SE',
	'th',
	'tr',
	'uk',
	'vi',
	'zh-CN',
	'zh-TW',
] as const;

type LocaleCode = (typeof supportedLocales)[number];
const DEFAULT_LOCALE: LocaleCode = 'en-US';
const supportedLocaleSet = new Set<LocaleCode>(supportedLocales);

const logger = new Logger('i18n');

const LANGUAGE_OVERRIDES: Record<string, LocaleCode> = {
	en: 'en-US',
};

type LocaleLoader = () => {messages: Messages};

const loaders: Record<LocaleCode, LocaleLoader> = {
	ar: () => ({messages: messagesAr}),
	bg: () => ({messages: messagesBg}),
	cs: () => ({messages: messagesCs}),
	da: () => ({messages: messagesDa}),
	de: () => ({messages: messagesDe}),
	el: () => ({messages: messagesEl}),
	'en-GB': () => ({messages: messagesEnGB}),
	'en-US': () => ({messages: messagesEnUS}),
	'es-ES': () => ({messages: messagesEsES}),
	'es-419': () => ({messages: messagesEs419}),
	fi: () => ({messages: messagesFi}),
	fr: () => ({messages: messagesFr}),
	he: () => ({messages: messagesHe}),
	hi: () => ({messages: messagesHi}),
	hr: () => ({messages: messagesHr}),
	hu: () => ({messages: messagesHu}),
	id: () => ({messages: messagesId}),
	it: () => ({messages: messagesIt}),
	ja: () => ({messages: messagesJa}),
	ko: () => ({messages: messagesKo}),
	lt: () => ({messages: messagesLt}),
	nl: () => ({messages: messagesNl}),
	no: () => ({messages: messagesNo}),
	pl: () => ({messages: messagesPl}),
	'pt-BR': () => ({messages: messagesPtBR}),
	ro: () => ({messages: messagesRo}),
	ru: () => ({messages: messagesRu}),
	'sv-SE': () => ({messages: messagesSvSE}),
	th: () => ({messages: messagesTh}),
	tr: () => ({messages: messagesTr}),
	uk: () => ({messages: messagesUk}),
	vi: () => ({messages: messagesVi}),
	'zh-CN': () => ({messages: messagesZhCN}),
	'zh-TW': () => ({messages: messagesZhTW}),
};

function formatLocaleValue(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return '';
	}

	const segments = trimmed.split(/[-_]/).filter(Boolean);
	if (segments.length === 0) {
		return '';
	}

	const language = segments[0].toLowerCase();
	if (segments.length === 1) {
		return language;
	}

	const region = segments
		.slice(1)
		.map((segment) => segment.toUpperCase())
		.join('-');

	return `${language}-${region}`;
}

function normalizeLocale(value?: string | null): LocaleCode {
	if (!value) {
		return DEFAULT_LOCALE;
	}

	const formatted = formatLocaleValue(value);
	if (!formatted) {
		return DEFAULT_LOCALE;
	}

	if (supportedLocaleSet.has(formatted as LocaleCode)) {
		return formatted as LocaleCode;
	}

	const [language] = formatted.split('-');
	if (!language) {
		return DEFAULT_LOCALE;
	}

	const override = LANGUAGE_OVERRIDES[language];
	if (override) {
		return override;
	}

	const fallback = supportedLocales.find((code) => code.split('-')[0].toLowerCase() === language);
	if (fallback) {
		return fallback;
	}

	return DEFAULT_LOCALE;
}

function detectBrowserLocale(): string | null {
	if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
		return navigator.languages[0];
	}

	return navigator.language ?? null;
}

function detectPreferredLocale(forceLocale?: string): LocaleCode {
	if (forceLocale) {
		return normalizeLocale(forceLocale);
	}

	const storedLocale = AppStorage.getItem('locale');
	if (storedLocale) {
		return normalizeLocale(storedLocale);
	}

	const nativeLocale = getNativeLocaleIdentifier();
	if (nativeLocale) {
		return normalizeLocale(nativeLocale);
	}

	const browserLocale = detectBrowserLocale();
	if (browserLocale) {
		return normalizeLocale(browserLocale);
	}

	return DEFAULT_LOCALE;
}

export function loadLocaleCatalog(localeCode: string): LocaleCode {
	const normalized = normalizeLocale(localeCode);
	const {messages} = loaders[normalized]();
	i18n.loadAndActivate({locale: normalized, messages});
	AppStorage.setItem('locale', normalized);
	return normalized;
}

let initPromise: Promise<typeof i18n> | null = null;

export async function initI18n(forceLocale?: string) {
	if (!initPromise) {
		initPromise = (async () => {
			try {
				const localeToLoad = detectPreferredLocale(forceLocale);
				loadLocaleCatalog(localeToLoad);
			} catch (error) {
				logger.error('Failed to initialize i18n, falling back to default locale', error);
				loadLocaleCatalog(DEFAULT_LOCALE);
			}

			return i18n;
		})();
	}

	return initPromise;
}

export default i18n;
