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
import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import {FluxerError} from '@fluxer/errors/src/FluxerError';

export interface FieldError {
	field: string;
	code: string;
	message: string;
}

export interface ValidationErrorOptions {
	code?: string;
	message?: string;
	errors: Array<FieldError>;
}

export class ValidationError extends FluxerError {
	readonly errors: Array<FieldError>;

	constructor(options: ValidationErrorOptions) {
		super({
			code: options.code ?? APIErrorCodes.VALIDATION_ERROR,
			message: options.message ?? 'Validation failed',
			status: HttpStatus.BAD_REQUEST,
			data: {errors: options.errors},
		});
		this.name = 'ValidationError';
		this.errors = options.errors;
	}

	override getResponse(): Response {
		return new Response(
			JSON.stringify({
				code: this.code,
				message: this.message,
				errors: this.errors,
			}),
			{
				status: this.status,
				headers: {
					'Content-Type': 'application/json',
				},
			},
		);
	}

	static fromField(field: string, code: string, message: string): ValidationError {
		return new ValidationError({
			errors: [{field, code, message}],
		});
	}

	static fromFields(errors: Array<FieldError>): ValidationError {
		return new ValidationError({errors});
	}
}
