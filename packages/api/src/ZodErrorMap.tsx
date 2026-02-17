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

import type {ValidationErrorCode} from '@fluxer/constants/src/ValidationErrorCodes';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {z} from 'zod';

const validationErrorCodeSet = new Set<string>(Object.values(ValidationErrorCodes));

function isValidationErrorCode(value: string): value is ValidationErrorCode {
	return validationErrorCodeSet.has(value);
}

function getParamsProperty(obj: object): Record<string, unknown> | undefined {
	if ('params' in obj) {
		const value = (obj as {params?: unknown}).params;
		return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
	}
	return undefined;
}

export function fluxerZodErrorMap(
	issue: Parameters<z.core.$ZodErrorMap>[0],
): {message: string} | string | undefined | null {
	if (issue.message && isValidationErrorCode(issue.message)) {
		return {message: issue.message};
	}

	let errorCode: ValidationErrorCode;

	switch (issue.code) {
		case 'invalid_type': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}

		case 'unrecognized_keys': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}

		case 'invalid_union': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}

		case 'invalid_value': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}

		case 'too_small': {
			const origin = 'origin' in issue ? String(issue.origin) : undefined;
			if (origin === 'date') {
				errorCode = ValidationErrorCodes.INVALID_DATE_OF_BIRTH_FORMAT;
			} else {
				errorCode = ValidationErrorCodes.INVALID_FORMAT;
			}
			break;
		}

		case 'too_big': {
			const origin = 'origin' in issue ? String(issue.origin) : undefined;
			if (origin === 'string') {
				errorCode = ValidationErrorCodes.CONTENT_EXCEEDS_MAX_LENGTH;
			} else if (origin === 'date') {
				errorCode = ValidationErrorCodes.SCHEDULED_TIME_MUST_BE_FUTURE;
			} else {
				errorCode = ValidationErrorCodes.INVALID_FORMAT;
			}
			break;
		}

		case 'invalid_format': {
			const format = 'format' in issue ? String(issue.format) : undefined;
			if (format === 'email') {
				errorCode = ValidationErrorCodes.INVALID_EMAIL_ADDRESS;
			} else if (format === 'uuid') {
				errorCode = ValidationErrorCodes.INVALID_SNOWFLAKE;
			} else {
				errorCode = ValidationErrorCodes.INVALID_FORMAT;
			}
			break;
		}

		case 'not_multiple_of': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}

		case 'custom': {
			const params = getParamsProperty(issue);
			const customErrorCode = params?.['error_code'];
			errorCode =
				typeof customErrorCode === 'string' && isValidationErrorCode(customErrorCode)
					? customErrorCode
					: ValidationErrorCodes.INVALID_FORMAT;
			break;
		}

		case 'invalid_key':
		case 'invalid_element': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}

		default: {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
	}

	return {message: errorCode};
}

export function initializeFluxerErrorMap(): void {
	z.config({customError: fluxerZodErrorMap});
}
