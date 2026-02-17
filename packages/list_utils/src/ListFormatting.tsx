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

import {Locales} from '@fluxer/constants/src/Locales';
import {getCachedListFormatter} from '@fluxer/list_utils/src/ListFormattingCache';
import {formatListWithFallback} from '@fluxer/list_utils/src/ListFormattingFallback';
import {isIntlListFormatLocaleSupported, isIntlListFormatSupported} from '@fluxer/list_utils/src/ListFormattingSupport';
import type {
	IListFormatter,
	ListFormatOptions,
	ListFormatStyle,
	ListFormatType,
	ListFormatterConfig,
	ResolvedListFormatterConfig,
} from '@fluxer/list_utils/src/ListFormattingTypes';

const DEFAULT_LOCALE = Locales.EN_US;
const DEFAULT_LIST_FORMAT_STYLE: ListFormatStyle = 'long';
const DEFAULT_LIST_FORMAT_TYPE: ListFormatType = 'conjunction';

export function isListFormatSupported(): boolean {
	return isIntlListFormatSupported();
}

function normalizeLocale(locale: string): string {
	if (!isIntlListFormatLocaleSupported(locale)) {
		return DEFAULT_LOCALE;
	}

	return locale;
}

function resolveListFormatterConfig(config: ListFormatterConfig): ResolvedListFormatterConfig {
	const requestedLocale = config.locale?.trim();
	const locale = requestedLocale == null || requestedLocale === '' ? DEFAULT_LOCALE : normalizeLocale(requestedLocale);
	const style = config.style ?? DEFAULT_LIST_FORMAT_STYLE;
	const type = config.type ?? DEFAULT_LIST_FORMAT_TYPE;

	return {
		locale,
		style,
		type,
	};
}

function formatWithIntl(items: ReadonlyArray<string>, config: ResolvedListFormatterConfig): string {
	try {
		return getCachedListFormatter(config).format(items);
	} catch {
		return formatListWithFallback(items, config.type);
	}
}

function formatItems(items: ReadonlyArray<string>, config: ResolvedListFormatterConfig): string {
	if (items.length === 0) {
		return '';
	}

	if (items.length === 1) {
		return items[0] ?? '';
	}

	if (!isListFormatSupported()) {
		return formatListWithFallback(items, config.type);
	}

	return formatWithIntl(items, config);
}

export function formatListWithConfig(items: ReadonlyArray<string>, config: ListFormatterConfig = {}): string {
	const resolvedConfig = resolveListFormatterConfig(config);
	return formatItems(items, resolvedConfig);
}

export function createListFormatter(config: ListFormatterConfig = {}): IListFormatter {
	const resolvedConfig = resolveListFormatterConfig(config);

	return {
		format(items: ReadonlyArray<string>): string {
			return formatItems(items, resolvedConfig);
		},
	};
}

export function formatList(
	items: Array<string>,
	locale: string = DEFAULT_LOCALE,
	options: ListFormatOptions = {},
): string {
	return formatListWithConfig(items, {
		locale,
		style: options.style,
		type: options.type,
	});
}
