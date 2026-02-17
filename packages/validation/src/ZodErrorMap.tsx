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

import {resolveZodIssueValidationErrorCode} from '@fluxer/validation/src/error_map/ZodIssueErrorCodeResolver';
import {isValidationErrorCode} from '@fluxer/validation/src/shared/ValidationErrorCodeUtils';
import {z} from 'zod';

let isFluxerErrorMapInitialized = false;

export function fluxerZodErrorMap(
	issue: Parameters<z.core.$ZodErrorMap>[0],
): {message: string} | string | undefined | null {
	if (typeof issue.message === 'string' && isValidationErrorCode(issue.message)) {
		return {message: issue.message};
	}

	return {message: resolveZodIssueValidationErrorCode(issue)};
}

export function initializeFluxerErrorMap(): void {
	if (isFluxerErrorMapInitialized) {
		return;
	}

	z.config({customError: fluxerZodErrorMap});
	isFluxerErrorMapInitialized = true;
}
