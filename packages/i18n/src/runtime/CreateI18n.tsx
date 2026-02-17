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
import {hasLocaleFile} from '@fluxer/i18n/src/io/LocaleFilePath';
import {parseYamlRecord} from '@fluxer/i18n/src/io/ParseYamlRecord';
import {buildTemplates} from '@fluxer/i18n/src/runtime/BuildTemplates';
import {getTemplate} from '@fluxer/i18n/src/runtime/GetTemplate';
import type {I18nConfig, I18nResult, I18nState, TemplateCompiler} from '@fluxer/i18n/src/runtime/I18nTypes';

interface I18nModule<TKey extends string, TValue, TVariables> {
	getTemplate(key: TKey, locale: string | null, variables: TVariables): I18nResult<TKey, TValue>;
	hasLocale(locale: string): boolean;
	getLoadedLocales(): Set<string>;
	reset(): void;
	getState(): I18nState<TKey, TValue, TVariables>;
}

export function createI18n<TKey extends string, TValue, TVariables>(
	config: I18nConfig<TKey, TValue, TVariables>,
	compile: TemplateCompiler<TValue, TVariables>,
): I18nModule<TKey, TValue, TVariables> {
	const onWarning = config.onWarning ?? console.warn;

	const state: I18nState<TKey, TValue, TVariables> = {
		loadedLocales: new Set(),
		templatesByLocale: new Map(),
		messageFormatCache: new Map(),
		config: {...config, onWarning},
	};

	loadDefaultLocale();

	function loadDefaultLocale(): void {
		if (!fs.existsSync(state.config.defaultMessagesFile)) {
			onWarning(`Default messages bundle not found: ${state.config.defaultMessagesFile}`);
			return;
		}

		const raw = fs.readFileSync(state.config.defaultMessagesFile, 'utf8');
		const parsed = parseYamlRecord(raw);
		const templates = buildTemplates(parsed, state.config, state.config.defaultMessagesFile);

		state.templatesByLocale.set(state.config.defaultLocale, templates);
		state.loadedLocales.add(state.config.defaultLocale);
	}

	return {
		getTemplate(key: TKey, locale: string | null, variables: TVariables): I18nResult<TKey, TValue> {
			return getTemplate(state, key, locale, variables, compile);
		},

		hasLocale(locale: string): boolean {
			return hasLocaleFile(locale, state.config.localesPath, state.config.defaultLocale);
		},

		getLoadedLocales(): Set<string> {
			return new Set(state.loadedLocales);
		},

		reset(): void {
			state.loadedLocales.clear();
			state.templatesByLocale.clear();
			state.messageFormatCache.clear();
			loadDefaultLocale();
		},

		getState(): I18nState<TKey, TValue, TVariables> {
			return state;
		},
	};
}
