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
import type {ValidationErrorCode} from '@fluxer/constants/src/ValidationErrorCodes';
import {BadRequestError} from '@fluxer/errors/src/domains/core/BadRequestError';
import type {ValidationError} from '@fluxer/errors/src/domains/core/ValidationError';

export interface LocalizedValidationError {
	path: string;
	code: ValidationErrorCode;
	variables?: Record<string, unknown>;
}

export class InputValidationError extends BadRequestError {
	readonly localizedErrors: Array<LocalizedValidationError> | null;

	constructor(errors: Array<ValidationError>, localizedErrors?: Array<LocalizedValidationError>) {
		super({code: APIErrorCodes.INVALID_FORM_BODY, data: {errors}});
		this.localizedErrors = localizedErrors ?? null;
	}

	public getLocalizedErrors(): Array<LocalizedValidationError> | null {
		return this.localizedErrors;
	}

	static create(path: string, message: string): InputValidationError {
		return new InputValidationError([{path, message}]);
	}

	static createMultiple(errors: Array<{field: string; message: string}>): InputValidationError {
		return new InputValidationError(errors.map((e) => ({path: e.field, message: e.message})));
	}

	static fromCode(path: string, code: ValidationErrorCode, variables?: Record<string, unknown>): InputValidationError {
		return new InputValidationError([{path, message: code, code}], [{path, code, variables}]);
	}

	static fromCodes(errors: Array<LocalizedValidationError>): InputValidationError {
		const validationErrors = errors.map((e) => ({
			path: e.path,
			message: e.code,
			code: e.code,
		}));
		return new InputValidationError(validationErrors, errors);
	}
}
