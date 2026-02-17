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

import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {APIErrorCodesDescriptions} from '@fluxer/constants/src/ApiErrorCodesDescriptions';
import type {OpenAPIRef, OpenAPISchema} from '@fluxer/openapi/src/Types';

export const SnowflakeTypeSchema: OpenAPISchema = {
	type: 'string',
	pattern: '^(0|[1-9][0-9]*)$',
	format: 'snowflake',
};

export const SnowflakeTypeRef: OpenAPIRef = {$ref: '#/components/schemas/SnowflakeType'};

export const Int32TypeSchema: OpenAPISchema = {
	type: 'integer',
	minimum: 0,
	maximum: 2147483647,
	format: 'int32',
};

export const Int32TypeRef: OpenAPIRef = {$ref: '#/components/schemas/Int32Type'};

export const Int64TypeSchema: OpenAPISchema = {
	type: 'string',
	format: 'int64',
	pattern: '^-?[0-9]+$',
};

export const Int64TypeRef: OpenAPIRef = {$ref: '#/components/schemas/Int64Type'};

export const Int64StringTypeSchema: OpenAPISchema = {
	type: 'string',
	format: 'int64',
	pattern: '^-?[0-9]+$',
};

export const Int64StringTypeRef: OpenAPIRef = {$ref: '#/components/schemas/Int64StringType'};

export const UnsignedInt64TypeSchema: OpenAPISchema = {
	type: 'string',
	format: 'int64',
	pattern: '^[0-9]+$',
};

export const UnsignedInt64TypeRef: OpenAPIRef = {$ref: '#/components/schemas/UnsignedInt64Type'};

export const UsernameTypeSchema: OpenAPISchema = {
	type: 'string',
	minLength: 1,
	maxLength: 32,
	pattern: '^[a-zA-Z0-9_]+$',
};

export const UsernameTypeRef: OpenAPIRef = {$ref: '#/components/schemas/UsernameType'};

export const EmailTypeSchema: OpenAPISchema = {
	type: 'string',
	format: 'email',
};

export const EmailTypeRef: OpenAPIRef = {$ref: '#/components/schemas/EmailType'};

export const PasswordTypeSchema: OpenAPISchema = {
	type: 'string',
	minLength: 8,
	maxLength: 256,
};

export const PasswordTypeRef: OpenAPIRef = {$ref: '#/components/schemas/PasswordType'};

export const PhoneNumberTypeSchema: OpenAPISchema = {
	type: 'string',
	pattern: '^\\+[1-9]\\d{1,14}$',
};

export const PhoneNumberTypeRef: OpenAPIRef = {$ref: '#/components/schemas/PhoneNumberType'};

export const Base64ImageTypeSchema: OpenAPISchema = {
	type: 'string',
	format: 'byte',
	description: 'Base64-encoded image data',
};

export const Base64ImageTypeRef: OpenAPIRef = {$ref: '#/components/schemas/Base64ImageType'};

export const LocaleSchema = {
	type: 'string',
	enum: [
		'ar',
		'bg',
		'cs',
		'da',
		'de',
		'el',
		'en-GB',
		'en-US',
		'es-ES',
		'es-419',
		'fi',
		'fr',
		'he',
		'hi',
		'hr',
		'hu',
		'id',
		'it',
		'ja',
		'ko',
		'lt',
		'nl',
		'no',
		'pl',
		'pt-BR',
		'ro',
		'ru',
		'sv-SE',
		'th',
		'tr',
		'uk',
		'vi',
		'zh-CN',
		'zh-TW',
	],
	'x-enumNames': [
		'AR',
		'BG',
		'CS',
		'DA',
		'DE',
		'EL',
		'EN_GB',
		'EN_US',
		'ES_ES',
		'ES_419',
		'FI',
		'FR',
		'HE',
		'HI',
		'HR',
		'HU',
		'ID',
		'IT',
		'JA',
		'KO',
		'LT',
		'NL',
		'NO',
		'PL',
		'PT_BR',
		'RO',
		'RU',
		'SV_SE',
		'TH',
		'TR',
		'UK',
		'VI',
		'ZH_CN',
		'ZH_TW',
	],
	'x-enumDescriptions': [
		'Arabic',
		'Bulgarian',
		'Czech',
		'Danish',
		'German',
		'Greek',
		'English (United Kingdom)',
		'English (United States)',
		'Spanish (Spain)',
		'Spanish (Latin America)',
		'Finnish',
		'French',
		'Hebrew',
		'Hindi',
		'Croatian',
		'Hungarian',
		'Indonesian',
		'Italian',
		'Japanese',
		'Korean',
		'Lithuanian',
		'Dutch',
		'Norwegian',
		'Polish',
		'Portuguese (Brazil)',
		'Romanian',
		'Russian',
		'Swedish',
		'Thai',
		'Turkish',
		'Ukrainian',
		'Vietnamese',
		'Chinese (Simplified)',
		'Chinese (Traditional)',
	],
	description: 'The locale code for the user interface language',
} as const satisfies OpenAPISchema & Record<string, unknown>;

export const LocaleRef: OpenAPIRef = {$ref: '#/components/schemas/Locale'};

const apiErrorCodeValues = Object.values(APIErrorCodes);
const apiErrorCodeDescriptions = Object.keys(APIErrorCodes).map(
	(key) => APIErrorCodesDescriptions[key as keyof typeof APIErrorCodesDescriptions] ?? '',
);

export const APIErrorCodeSchema = {
	type: 'string',
	enum: apiErrorCodeValues,
	'x-enumDescriptions': apiErrorCodeDescriptions,
	description: 'Error codes returned by API operations',
} as const satisfies OpenAPISchema & Record<string, unknown>;

export const APIErrorCodeRef: OpenAPIRef = {$ref: '#/components/schemas/APIErrorCode'};
