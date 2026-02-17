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

import * as path from 'node:path';
import type {ErrorI18nKey} from '@fluxer/errors/src/i18n/ErrorI18nTypes.generated';
import {identityLocale} from '@fluxer/i18n/src/normalization/IdentityLocale';
import {createI18n} from '@fluxer/i18n/src/runtime/CreateI18n';
import type {I18nResult} from '@fluxer/i18n/src/runtime/I18nTypes';

const LOCALES_PATH = path.join(import.meta.dirname, 'locales');
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_MESSAGES_FILE = path.join(LOCALES_PATH, 'messages.yaml');

const errorI18n = createI18n<ErrorI18nKey, string, Record<string, unknown>>(
	{
		localesPath: LOCALES_PATH,
		defaultLocale: DEFAULT_LOCALE,
		defaultMessagesFile: DEFAULT_MESSAGES_FILE,
		normalizeLocale: (locale) => identityLocale(locale),
		parseTemplate: (value): string | null => {
			if (typeof value === 'string') {
				return value;
			}
			return null;
		},
		onWarning: (message) => {
			console.warn(message);
		},
	},
	(template, variables, mf) => {
		if (variables && Object.keys(variables).length > 0) {
			try {
				return String(mf.compile(template)(variables));
			} catch {
				return template.replace(/\{([^}]+)\}/g, (match, key) => {
					const value = variables[key];
					if (value !== undefined) {
						return String(value);
					}
					return match;
				});
			}
		}
		return template;
	},
);

export function getErrorMessageResult(
	key: ErrorI18nKey,
	locale: string | null | undefined,
	variables?: Record<string, unknown>,
): I18nResult<ErrorI18nKey, string> {
	return errorI18n.getTemplate(key, locale ?? null, variables ?? {});
}

export function getErrorMessage(
	key: ErrorI18nKey,
	locale: string | null | undefined,
	variables?: Record<string, unknown>,
	fallbackMessage?: string,
): string {
	const result = getErrorMessageResult(key, locale, variables);
	if (result.ok) {
		return result.value;
	}
	if (result.error.kind === 'missing-template') {
		console.warn(`Missing translation for error message: ${key} (locale: ${locale ?? DEFAULT_LOCALE})`);
		return fallbackMessage ?? key;
	}
	return fallbackMessage ?? key;
}

export function hasErrorLocale(locale: string): boolean {
	return errorI18n.hasLocale(locale);
}

export function resetErrorI18n(): void {
	errorI18n.reset();
}
