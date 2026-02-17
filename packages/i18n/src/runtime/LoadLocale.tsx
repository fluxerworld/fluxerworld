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

import * as fs from 'node:fs';
import {localeFilePath} from '@fluxer/i18n/src/io/LocaleFilePath';
import {parseYamlRecord} from '@fluxer/i18n/src/io/ParseYamlRecord';
import {buildTemplates} from '@fluxer/i18n/src/runtime/BuildTemplates';
import type {I18nState} from '@fluxer/i18n/src/runtime/I18nTypes';

export function loadLocaleIfNotLoaded<TKey extends string, TValue, TVariables>(
	state: I18nState<TKey, TValue, TVariables>,
	locale: string,
): void {
	if (locale === state.config.defaultLocale) {
		return;
	}

	if (state.loadedLocales.has(locale)) {
		return;
	}

	const filePath = localeFilePath(locale, state.config.localesPath);

	if (!fs.existsSync(filePath)) {
		state.config.onWarning?.(
			`Locale file not found for ${locale}: ${filePath}. Falling back to ${state.config.defaultLocale}.`,
		);
		return;
	}

	const raw = fs.readFileSync(filePath, 'utf8');
	const parsed = parseYamlRecord(raw);
	const templates = buildTemplates(parsed, state.config, filePath);

	let localeMap = state.templatesByLocale.get(locale);
	if (!localeMap) {
		localeMap = new Map();
		state.templatesByLocale.set(locale, localeMap);
	}

	for (const [key, template] of templates) {
		localeMap.set(key, template);
	}

	state.loadedLocales.add(locale);
}
