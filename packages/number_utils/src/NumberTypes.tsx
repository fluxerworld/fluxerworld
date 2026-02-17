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

export type NumberInput = number | string | null | undefined;

export interface NumberFormatBaseOptions {
	locale?: string;
	fallbackValue?: number;
}

export interface NumberFormatOptions extends NumberFormatBaseOptions {
	numberFormatOptions?: Intl.NumberFormatOptions;
}

export interface CompactNumberFormatOptions extends NumberFormatBaseOptions {
	maximumFractionDigits?: number;
	minimumFractionDigits?: number;
}

export interface CurrencyNumberFormatOptions extends NumberFormatBaseOptions {
	currency: string;
	numberFormatOptions?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>;
}

export interface NumberFormatterFactoryOptions extends NumberFormatBaseOptions {}

export interface BoundCompactNumberFormatOptions {
	maximumFractionDigits?: number;
	minimumFractionDigits?: number;
}

export interface BoundCurrencyNumberFormatOptions {
	currency: string;
	numberFormatOptions?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>;
}

export interface INumberFormatter {
	parse(value: NumberInput): number;
	format(value: NumberInput, numberFormatOptions?: Intl.NumberFormatOptions): string;
	formatCompact(value: NumberInput, options?: BoundCompactNumberFormatOptions): string;
	formatCurrency(value: NumberInput, options: BoundCurrencyNumberFormatOptions): string;
}
