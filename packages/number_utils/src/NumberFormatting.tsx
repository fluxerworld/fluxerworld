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

import {
	DEFAULT_COMPACT_MAX_FRACTION_DIGITS,
	DEFAULT_NUMBER_FALLBACK,
	DEFAULT_NUMBER_LOCALE,
} from '@fluxer/number_utils/src/NumberConstants';
import {getNumberFormatter} from '@fluxer/number_utils/src/NumberFormatterCache';
import {parseNumberInput} from '@fluxer/number_utils/src/NumberParsing';
import type {
	BoundCompactNumberFormatOptions,
	BoundCurrencyNumberFormatOptions,
	CompactNumberFormatOptions,
	CurrencyNumberFormatOptions,
	INumberFormatter,
	NumberFormatBaseOptions,
	NumberFormatOptions,
	NumberFormatterFactoryOptions,
	NumberInput,
} from '@fluxer/number_utils/src/NumberTypes';

interface ResolvedNumberFormatBaseOptions {
	locale: string;
	fallbackValue: number;
}

interface CompactFormatOptionsInput {
	maximumFractionDigits?: number;
	minimumFractionDigits?: number;
}

interface CurrencyFormatOptionsInput {
	currency: string;
	numberFormatOptions?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>;
}

function resolveBaseOptions(options?: NumberFormatBaseOptions): ResolvedNumberFormatBaseOptions {
	return {
		locale: options?.locale ?? DEFAULT_NUMBER_LOCALE,
		fallbackValue: options?.fallbackValue ?? DEFAULT_NUMBER_FALLBACK,
	};
}

function resolveNumberFormatOptions(optionsOrLocale: NumberFormatOptions | string | undefined): NumberFormatOptions {
	if (typeof optionsOrLocale === 'string') {
		return {locale: optionsOrLocale};
	}

	return optionsOrLocale ?? {};
}

function resolveCompactFormatOptions(
	optionsOrLocale: CompactNumberFormatOptions | string | undefined,
	maximumFractionDigits: number | undefined,
): CompactNumberFormatOptions {
	if (typeof optionsOrLocale === 'string') {
		return {
			locale: optionsOrLocale,
			maximumFractionDigits,
		};
	}

	if (optionsOrLocale === undefined) {
		if (maximumFractionDigits === undefined) {
			return {};
		}

		return {maximumFractionDigits};
	}

	if (maximumFractionDigits === undefined) {
		return optionsOrLocale;
	}

	return {
		...optionsOrLocale,
		maximumFractionDigits: optionsOrLocale.maximumFractionDigits ?? maximumFractionDigits,
	};
}

function resolveCurrencyFormatOptions(
	optionsOrCurrency: CurrencyNumberFormatOptions | string,
	locale: string | undefined,
): CurrencyNumberFormatOptions {
	if (typeof optionsOrCurrency === 'string') {
		return {
			currency: optionsOrCurrency,
			locale,
		};
	}

	return optionsOrCurrency;
}

function formatNumberValue(
	value: NumberInput,
	resolvedOptions: ResolvedNumberFormatBaseOptions,
	numberFormatOptions: Intl.NumberFormatOptions = {},
): string {
	const parsedValue = parseNumberInput(value, resolvedOptions.fallbackValue);
	return getNumberFormatter(resolvedOptions.locale, numberFormatOptions).format(parsedValue);
}

function buildCompactFormatOptions(options: CompactFormatOptionsInput): Intl.NumberFormatOptions {
	const numberFormatOptions: Intl.NumberFormatOptions = {
		notation: 'compact',
		maximumFractionDigits: options.maximumFractionDigits ?? DEFAULT_COMPACT_MAX_FRACTION_DIGITS,
	};

	if (options.minimumFractionDigits !== undefined) {
		numberFormatOptions.minimumFractionDigits = options.minimumFractionDigits;
	}

	return numberFormatOptions;
}

function buildCurrencyFormatOptions(options: CurrencyFormatOptionsInput): Intl.NumberFormatOptions {
	return {
		...options.numberFormatOptions,
		style: 'currency',
		currency: options.currency,
	};
}

export function parseNumber(value: NumberInput, options: NumberFormatBaseOptions = {}): number {
	const resolvedOptions = resolveBaseOptions(options);
	return parseNumberInput(value, resolvedOptions.fallbackValue);
}

export function formatNumber(value: NumberInput, locale?: string): string;
export function formatNumber(value: NumberInput, options?: NumberFormatOptions): string;
export function formatNumber(value: NumberInput, optionsOrLocale: NumberFormatOptions | string = {}): string {
	const options = resolveNumberFormatOptions(optionsOrLocale);
	const resolvedOptions = resolveBaseOptions(options);
	return formatNumberValue(value, resolvedOptions, options.numberFormatOptions);
}

export function formatCompactNumber(value: NumberInput, locale?: string, maximumFractionDigits?: number): string;
export function formatCompactNumber(value: NumberInput, options?: CompactNumberFormatOptions): string;
export function formatCompactNumber(
	value: NumberInput,
	optionsOrLocale: CompactNumberFormatOptions | string = {},
	maximumFractionDigits?: number,
): string {
	const options = resolveCompactFormatOptions(optionsOrLocale, maximumFractionDigits);
	const resolvedOptions = resolveBaseOptions(options);
	return formatNumberValue(value, resolvedOptions, buildCompactFormatOptions(options));
}

export function formatCurrency(value: NumberInput, currency: string, locale?: string): string;
export function formatCurrency(value: NumberInput, options: CurrencyNumberFormatOptions): string;
export function formatCurrency(
	value: NumberInput,
	optionsOrCurrency: CurrencyNumberFormatOptions | string,
	locale?: string,
): string {
	const options = resolveCurrencyFormatOptions(optionsOrCurrency, locale);
	const resolvedOptions = resolveBaseOptions(options);
	return formatNumberValue(value, resolvedOptions, buildCurrencyFormatOptions(options));
}

export function createNumberFormatter(options: NumberFormatterFactoryOptions = {}): INumberFormatter {
	const resolvedOptions = resolveBaseOptions(options);

	function parse(value: NumberInput): number {
		return parseNumberInput(value, resolvedOptions.fallbackValue);
	}

	function format(value: NumberInput, numberFormatOptions: Intl.NumberFormatOptions = {}): string {
		return formatNumberValue(value, resolvedOptions, numberFormatOptions);
	}

	function formatCompact(value: NumberInput, compactOptions: BoundCompactNumberFormatOptions = {}): string {
		return formatNumberValue(value, resolvedOptions, buildCompactFormatOptions(compactOptions));
	}

	function formatCurrency(value: NumberInput, currencyOptions: BoundCurrencyNumberFormatOptions): string {
		return formatNumberValue(value, resolvedOptions, buildCurrencyFormatOptions(currencyOptions));
	}

	return {
		parse,
		format,
		formatCompact,
		formatCurrency,
	};
}
