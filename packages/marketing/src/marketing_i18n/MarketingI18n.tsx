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
import {SimpleInterpolator} from '@fluxer/i18n/src/interpolation/SimpleInterpolator';
import {identityLocale} from '@fluxer/i18n/src/normalization/IdentityLocale';
import {createI18n} from '@fluxer/i18n/src/runtime/CreateI18n';
import type {I18nResult} from '@fluxer/i18n/src/runtime/I18nTypes';
import type {MarketingI18nKey} from '@fluxer/marketing/src/marketing_i18n/MarketingI18nTypes.generated';

type MarketingVariables = Record<string, unknown> | ReadonlyArray<unknown> | undefined;

const LOCALES_PATH = path.join(import.meta.dirname, 'locales');
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_MESSAGES_FILE = path.join(LOCALES_PATH, 'messages.yaml');

const interpolator = new SimpleInterpolator();

const marketingI18n = createI18n<MarketingI18nKey, string, MarketingVariables>(
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
			if (message.startsWith('Unsupported locale, falling back to en-US:')) {
				console.warn(
					`Unsupported locale for marketing translations, falling back to en-US: ${message.split(': ').slice(1).join(': ')}`,
				);
				return;
			}
			console.warn(message);
		},
		validateVariables: (key, template, variables) => {
			if (variables !== undefined) {
				return null;
			}
			if (/\{[^}]+\}/.test(template)) {
				return `Translation key "${key}" requires variables but none were provided. Template: "${template}"`;
			}
			return null;
		},
	},
	(template, variables) => {
		if (variables === undefined) {
			return template;
		}
		return interpolator.interpolate(template, variables);
	},
);

export function getMarketingMessageResult(
	key: MarketingI18nKey,
	locale: string | null,
	variables?: Record<string, unknown> | ReadonlyArray<unknown>,
): I18nResult<MarketingI18nKey, string> {
	return marketingI18n.getTemplate(key, locale, variables);
}

export function getMarketingMessage(
	key: MarketingI18nKey,
	locale: string | null,
	variables?: Record<string, unknown> | ReadonlyArray<unknown>,
): string {
	const result = getMarketingMessageResult(key, locale, variables);
	if (result.ok) {
		return result.value;
	}
	if (result.error.kind === 'missing-template') {
		console.warn(`Missing translation key: ${key}`);
		return key;
	}
	if (result.error.kind === 'invalid-variables') {
		console.warn(result.error.message);
		return key;
	}
	console.warn(result.error.message);
	return key;
}

export function hasMarketingLocale(locale: string): boolean {
	return marketingI18n.hasLocale(locale);
}

export function resetMarketingI18n(): void {
	marketingI18n.reset();
}
