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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const PricingTier = {
	Monthly: 'monthly',
	Yearly: 'yearly',
} as const;

export type PricingTier = ValueOf<typeof PricingTier>;

export const Currency = {
	USD: 'USD',
	EUR: 'EUR',
} as const;

export type Currency = ValueOf<typeof Currency>;

const EEA_COUNTRIES = [
	'AT',
	'BE',
	'BG',
	'HR',
	'CY',
	'CZ',
	'DK',
	'EE',
	'FI',
	'FR',
	'DE',
	'GR',
	'HU',
	'IE',
	'IT',
	'LV',
	'LT',
	'LU',
	'MT',
	'NL',
	'PL',
	'PT',
	'RO',
	'SK',
	'SI',
	'ES',
	'SE',
	'IS',
	'LI',
	'NO',
];

export function getCurrency(countryCode: string): Currency {
	return isEeaCountry(countryCode) ? Currency.EUR : Currency.USD;
}

export function isEeaCountry(countryCode: string): boolean {
	const upperCode = countryCode.toUpperCase();
	return EEA_COUNTRIES.includes(upperCode);
}

export function getPriceCents(tier: PricingTier, currency: Currency): number {
	if (tier === PricingTier.Monthly) return currency === Currency.USD ? 499 : 499;
	if (tier === PricingTier.Yearly) return currency === Currency.USD ? 4999 : 4999;
	return 0;
}

export function formatPriceCents(priceCents: number, currency: Currency): string {
	const amount = formatAmountCents(priceCents);
	return currency === Currency.EUR ? `€${amount}` : `$${amount}`;
}

function formatAmountCents(priceCents: number): string {
	const dollars = Math.floor(priceCents / 100);
	const cents = priceCents % 100;
	const centsText = cents < 10 ? `0${cents}` : `${cents}`;
	return `${dollars}.${centsText}`;
}

export function getFormattedPrice(tier: PricingTier, countryCode: string): string {
	const currency = getCurrency(countryCode);
	const priceCents = getPriceCents(tier, currency);
	return formatPriceCents(priceCents, currency);
}
