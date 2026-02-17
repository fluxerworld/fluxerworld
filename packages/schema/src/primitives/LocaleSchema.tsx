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

import {createNamedStringLiteralUnion, withOpenApiType} from '@fluxer/schema/src/primitives/SchemaPrimitives';

export const LocaleSchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['ar', 'AR', 'Arabic'],
			['bg', 'BG', 'Bulgarian'],
			['cs', 'CS', 'Czech'],
			['da', 'DA', 'Danish'],
			['de', 'DE', 'German'],
			['el', 'EL', 'Greek'],
			['en-GB', 'EN_GB', 'English (United Kingdom)'],
			['en-US', 'EN_US', 'English (United States)'],
			['es-ES', 'ES_ES', 'Spanish (Spain)'],
			['es-419', 'ES_419', 'Spanish (Latin America)'],
			['fi', 'FI', 'Finnish'],
			['fr', 'FR', 'French'],
			['he', 'HE', 'Hebrew'],
			['hi', 'HI', 'Hindi'],
			['hr', 'HR', 'Croatian'],
			['hu', 'HU', 'Hungarian'],
			['id', 'ID', 'Indonesian'],
			['it', 'IT', 'Italian'],
			['ja', 'JA', 'Japanese'],
			['ko', 'KO', 'Korean'],
			['lt', 'LT', 'Lithuanian'],
			['nl', 'NL', 'Dutch'],
			['no', 'NO', 'Norwegian'],
			['pl', 'PL', 'Polish'],
			['pt-BR', 'PT_BR', 'Portuguese (Brazil)'],
			['ro', 'RO', 'Romanian'],
			['ru', 'RU', 'Russian'],
			['sv-SE', 'SV_SE', 'Swedish'],
			['th', 'TH', 'Thai'],
			['tr', 'TR', 'Turkish'],
			['uk', 'UK', 'Ukrainian'],
			['vi', 'VI', 'Vietnamese'],
			['zh-CN', 'ZH_CN', 'Chinese (Simplified)'],
			['zh-TW', 'ZH_TW', 'Chinese (Traditional)'],
		] as const,
		'The locale code for the user interface language',
	),
	'Locale',
);
export type Locale =
	| 'ar'
	| 'bg'
	| 'cs'
	| 'da'
	| 'de'
	| 'el'
	| 'en-GB'
	| 'en-US'
	| 'es-ES'
	| 'es-419'
	| 'fi'
	| 'fr'
	| 'he'
	| 'hi'
	| 'hr'
	| 'hu'
	| 'id'
	| 'it'
	| 'ja'
	| 'ko'
	| 'lt'
	| 'nl'
	| 'no'
	| 'pl'
	| 'pt-BR'
	| 'ro'
	| 'ru'
	| 'sv-SE'
	| 'th'
	| 'tr'
	| 'uk'
	| 'vi'
	| 'zh-CN'
	| 'zh-TW';
