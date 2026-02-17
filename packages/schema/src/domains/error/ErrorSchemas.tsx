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

import {AnyErrorCodeSchema, ValidationErrorCodeSchema} from '@fluxer/schema/src/domains/error/ErrorCodeSchemas';
import {z} from 'zod';

export const ValidationErrorItem = z.object({
	path: z.string().describe('The field path where the validation error occurred'),
	message: z.string().describe('A human-readable description of the validation issue'),
	code: ValidationErrorCodeSchema.optional().describe('The validation error code for this issue'),
});
export type ValidationErrorItem = z.infer<typeof ValidationErrorItem>;

export const ErrorSchema = z.object({
	code: AnyErrorCodeSchema.describe('Error code identifier'),
	message: z.string().describe('Human-readable error message'),
	errors: z.array(ValidationErrorItem).optional().describe('Field-specific validation errors'),
});
export type ErrorResponse = z.infer<typeof ErrorSchema>;
