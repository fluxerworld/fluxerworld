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

import type MessageFormat from '@messageformat/core';

export type I18nErrorKind = 'missing-template' | 'invalid-variables' | 'compile-failed';

export interface I18nError<TKey extends string> {
	kind: I18nErrorKind;
	key: TKey;
	message: string;
}

export type I18nResult<TKey extends string, TValue> =
	| {ok: true; value: TValue; locale: string}
	| {ok: false; error: I18nError<TKey>; locale: string};

export interface I18nState<TKey extends string, TValue, TVariables> {
	loadedLocales: Set<string>;
	templatesByLocale: Map<string, Map<TKey, TValue>>;
	messageFormatCache: Map<string, MessageFormat>;
	config: I18nConfig<TKey, TValue, TVariables>;
}

export interface I18nConfig<TKey extends string, TValue, TVariables> {
	localesPath: string;
	defaultLocale: string;
	defaultMessagesFile: string;
	normalizeLocale?: (locale: string) => string;
	parseTemplate: (value: unknown, key: string) => TValue | null;
	onWarning?: (message: string) => void;
	validateVariables?: (key: TKey, template: TValue, variables: TVariables) => string | null;
}

export type TemplateCompiler<TValue, TVariables> = (
	template: TValue,
	variables: TVariables,
	mf: MessageFormat,
) => TValue;
