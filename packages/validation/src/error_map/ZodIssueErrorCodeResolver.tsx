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
import {isValidationErrorCode} from '@fluxer/validation/src/shared/ValidationErrorCodeUtils';
import type {z} from 'zod';

type ZodIssue = Parameters<z.core.$ZodErrorMap>[0];

function getIssueOrigin(issue: ZodIssue): string | undefined {
	if ('origin' in issue && typeof issue.origin === 'string') {
		return issue.origin;
	}
	return undefined;
}

function getIssueFormat(issue: ZodIssue): string | undefined {
	if ('format' in issue && typeof issue.format === 'string') {
		return issue.format;
	}
	return undefined;
}

function getIssueParams(issue: ZodIssue): Record<string, unknown> | undefined {
	if ('params' in issue && issue.params !== null && typeof issue.params === 'object') {
		return issue.params as Record<string, unknown>;
	}
	return undefined;
}

function getCustomErrorCode(issue: ZodIssue): ValidationErrorCode | undefined {
	const customErrorCode = getIssueParams(issue)?.['error_code'];
	if (typeof customErrorCode === 'string' && isValidationErrorCode(customErrorCode)) {
		return customErrorCode;
	}
	return undefined;
}

export function resolveZodIssueValidationErrorCode(issue: ZodIssue): ValidationErrorCode {
	switch (issue.code) {
		case 'too_small':
			return getIssueOrigin(issue) === 'date'
				? ValidationErrorCodes.INVALID_DATE_OF_BIRTH_FORMAT
				: ValidationErrorCodes.INVALID_FORMAT;
		case 'too_big': {
			const origin = getIssueOrigin(issue);
			if (origin === 'string') {
				return ValidationErrorCodes.CONTENT_EXCEEDS_MAX_LENGTH;
			}
			if (origin === 'date') {
				return ValidationErrorCodes.SCHEDULED_TIME_MUST_BE_FUTURE;
			}
			return ValidationErrorCodes.INVALID_FORMAT;
		}
		case 'invalid_format': {
			const format = getIssueFormat(issue);
			if (format === 'email') {
				return ValidationErrorCodes.INVALID_EMAIL_ADDRESS;
			}
			if (format === 'uuid') {
				return ValidationErrorCodes.INVALID_SNOWFLAKE;
			}
			return ValidationErrorCodes.INVALID_FORMAT;
		}
		case 'custom':
			return getCustomErrorCode(issue) ?? ValidationErrorCodes.INVALID_FORMAT;
		case 'invalid_type':
		case 'unrecognized_keys':
		case 'invalid_union':
		case 'invalid_value':
		case 'not_multiple_of':
		case 'invalid_key':
		case 'invalid_element':
			return ValidationErrorCodes.INVALID_FORMAT;
		default:
			return ValidationErrorCodes.INVALID_FORMAT;
	}
}
