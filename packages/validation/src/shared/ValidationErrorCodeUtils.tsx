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

const validationErrorCodeSet = new Set<string>(Object.values(ValidationErrorCodes));

export function isValidationErrorCode(value: string): value is ValidationErrorCode {
	return validationErrorCodeSet.has(value);
}

export function resolveValidationErrorCode(value: string | undefined): ValidationErrorCode {
	if (value !== undefined && isValidationErrorCode(value)) {
		return value;
	}
	return ValidationErrorCodes.INVALID_FORMAT;
}
