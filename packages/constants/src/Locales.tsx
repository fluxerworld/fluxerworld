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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const Locales = {
	AR: 'ar',
	BG: 'bg',
	CS: 'cs',
	DA: 'da',
	DE: 'de',
	EL: 'el',
	EN_GB: 'en-GB',
	EN_US: 'en-US',
	ES_ES: 'es-ES',
	ES_419: 'es-419',
	FI: 'fi',
	FR: 'fr',
	HE: 'he',
	HI: 'hi',
	HR: 'hr',
	HU: 'hu',
	ID: 'id',
	IT: 'it',
	JA: 'ja',
	KO: 'ko',
	LT: 'lt',
	NL: 'nl',
	NO: 'no',
	PL: 'pl',
	PT_BR: 'pt-BR',
	RO: 'ro',
	RU: 'ru',
	SV_SE: 'sv-SE',
	TH: 'th',
	TR: 'tr',
	UK: 'uk',
	VI: 'vi',
	ZH_CN: 'zh-CN',
	ZH_TW: 'zh-TW',
} as const;

export type LocaleCode = ValueOf<typeof Locales>;

export const AllLocales: ReadonlyArray<LocaleCode> = Object.values(Locales);
