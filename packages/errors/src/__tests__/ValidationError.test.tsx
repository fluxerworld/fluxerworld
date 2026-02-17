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

import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import {FluxerError} from '@fluxer/errors/src/FluxerError';
import {ValidationError} from '@fluxer/errors/src/ValidationError';
import {describe, expect, it} from 'vitest';

interface ValidationErrorBody {
	code: string;
	message: string;
	errors: Array<{field: string; code: string; message: string}>;
}

describe('ValidationError', () => {
	describe('constructor', () => {
		it('should create error with single field error', () => {
			const error = new ValidationError({
				errors: [{field: 'email', code: 'INVALID_EMAIL', message: 'Invalid email format'}],
			});

			expect(error.status).toBe(HttpStatus.BAD_REQUEST);
			expect(error.code).toBe('VALIDATION_ERROR');
			expect(error.message).toBe('Validation failed');
			expect(error.name).toBe('ValidationError');
			expect(error.errors).toEqual([{field: 'email', code: 'INVALID_EMAIL', message: 'Invalid email format'}]);
		});

		it('should create error with multiple field errors', () => {
			const fieldErrors = [
				{field: 'email', code: 'REQUIRED', message: 'Email is required'},
				{field: 'password', code: 'TOO_SHORT', message: 'Password must be at least 8 characters'},
				{field: 'username', code: 'INVALID_CHARS', message: 'Username contains invalid characters'},
			];

			const error = new ValidationError({errors: fieldErrors});

			expect(error.errors).toHaveLength(3);
			expect(error.errors).toEqual(fieldErrors);
		});

		it('should allow custom code', () => {
			const error = new ValidationError({
				code: 'INVALID_FORM_BODY',
				errors: [{field: 'name', code: 'REQUIRED', message: 'Name is required'}],
			});

			expect(error.code).toBe('INVALID_FORM_BODY');
		});

		it('should allow custom message', () => {
			const error = new ValidationError({
				message: 'Input validation failed',
				errors: [{field: 'name', code: 'REQUIRED', message: 'Name is required'}],
			});

			expect(error.message).toBe('Input validation failed');
		});

		it('should be instance of FluxerError', () => {
			const error = new ValidationError({
				errors: [{field: 'field', code: 'CODE', message: 'message'}],
			});

			expect(error).toBeInstanceOf(FluxerError);
		});
	});

	describe('getResponse', () => {
		it('should return JSON response with errors array', async () => {
			const error = new ValidationError({
				errors: [{field: 'email', code: 'INVALID', message: 'Invalid email'}],
			});

			const response = error.getResponse();

			expect(response.status).toBe(400);
			expect(response.headers.get('Content-Type')).toBe('application/json');

			const body = await response.json();
			expect(body).toEqual({
				code: 'VALIDATION_ERROR',
				message: 'Validation failed',
				errors: [{field: 'email', code: 'INVALID', message: 'Invalid email'}],
			});
		});

		it('should include multiple errors in response', async () => {
			const fieldErrors = [
				{field: 'email', code: 'REQUIRED', message: 'Email is required'},
				{field: 'password', code: 'TOO_SHORT', message: 'Password too short'},
			];

			const error = new ValidationError({errors: fieldErrors});
			const response = error.getResponse();
			const body = (await response.json()) as ValidationErrorBody;

			expect(body.errors).toHaveLength(2);
			expect(body.errors).toEqual(fieldErrors);
		});

		it('should include custom code and message in response', async () => {
			const error = new ValidationError({
				code: 'CUSTOM_VALIDATION',
				message: 'Custom validation message',
				errors: [{field: 'field', code: 'CODE', message: 'message'}],
			});

			const response = error.getResponse();
			const body = (await response.json()) as ValidationErrorBody;

			expect(body.code).toBe('CUSTOM_VALIDATION');
			expect(body.message).toBe('Custom validation message');
		});
	});

	describe('fromField static method', () => {
		it('should create ValidationError from single field', () => {
			const error = ValidationError.fromField('username', 'TAKEN', 'Username is already taken');

			expect(error).toBeInstanceOf(ValidationError);
			expect(error.errors).toEqual([{field: 'username', code: 'TAKEN', message: 'Username is already taken'}]);
		});

		it('should have default code and message', () => {
			const error = ValidationError.fromField('field', 'code', 'message');

			expect(error.code).toBe('VALIDATION_ERROR');
			expect(error.message).toBe('Validation failed');
		});
	});

	describe('fromFields static method', () => {
		it('should create ValidationError from multiple fields', () => {
			const fieldErrors = [
				{field: 'email', code: 'REQUIRED', message: 'Email is required'},
				{field: 'password', code: 'WEAK', message: 'Password is too weak'},
			];

			const error = ValidationError.fromFields(fieldErrors);

			expect(error).toBeInstanceOf(ValidationError);
			expect(error.errors).toEqual(fieldErrors);
		});

		it('should handle empty array', () => {
			const error = ValidationError.fromFields([]);

			expect(error.errors).toEqual([]);
		});
	});

	describe('error data structure', () => {
		it('should store errors in data property', () => {
			const fieldErrors = [{field: 'test', code: 'TEST', message: 'Test error'}];
			const error = new ValidationError({errors: fieldErrors});

			expect(error.data).toEqual({errors: fieldErrors});
		});

		it('should serialize correctly with toJSON', () => {
			const error = new ValidationError({
				errors: [{field: 'field', code: 'CODE', message: 'message'}],
			});

			const json = error.toJSON();

			expect(json).toEqual({
				code: 'VALIDATION_ERROR',
				message: 'Validation failed',
				errors: [{field: 'field', code: 'CODE', message: 'message'}],
			});
		});
	});

	describe('edge cases', () => {
		it('should handle field errors with special characters', () => {
			const error = new ValidationError({
				errors: [{field: 'user.email', code: 'INVALID', message: "Email can't be empty"}],
			});

			expect(error.errors[0].field).toBe('user.email');
			expect(error.errors[0].message).toBe("Email can't be empty");
		});

		it('should handle nested field paths', () => {
			const error = new ValidationError({
				errors: [
					{field: 'address.street', code: 'REQUIRED', message: 'Street is required'},
					{field: 'address.city', code: 'REQUIRED', message: 'City is required'},
					{field: 'address.zip', code: 'INVALID_FORMAT', message: 'Invalid ZIP code format'},
				],
			});

			expect(error.errors).toHaveLength(3);
			expect(error.errors[0].field).toBe('address.street');
		});

		it('should handle array index field paths', () => {
			const error = new ValidationError({
				errors: [
					{field: 'items[0].name', code: 'REQUIRED', message: 'Item name is required'},
					{field: 'items[1].quantity', code: 'MIN', message: 'Quantity must be at least 1'},
				],
			});

			expect(error.errors).toHaveLength(2);
			expect(error.errors[0].field).toBe('items[0].name');
		});
	});
});
