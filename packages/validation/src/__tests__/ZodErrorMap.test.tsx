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

import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {initializeFluxerErrorMap} from '@fluxer/validation/src/ZodErrorMap';
import {beforeAll, describe, expect, it} from 'vitest';
import {z} from 'zod';

describe('fluxerZodErrorMap', () => {
	beforeAll(() => {
		initializeFluxerErrorMap();
	});

	describe('invalid_type errors', () => {
		it('should return INVALID_FORMAT for number type mismatch', () => {
			const schema = z.number();
			const result = schema.safeParse('not a number');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT for string type mismatch', () => {
			const schema = z.string();
			const result = schema.safeParse(123);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT for object type mismatch', () => {
			const schema = z.object({name: z.string()});
			const result = schema.safeParse('not an object');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT for array type mismatch', () => {
			const schema = z.array(z.string());
			const result = schema.safeParse('not an array');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});
	});

	describe('unrecognized_keys errors', () => {
		it('should return INVALID_FORMAT for unrecognized keys in strict mode', () => {
			const schema = z.object({name: z.string()}).strict();
			const result = schema.safeParse({name: 'test', extra: 'field'});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});
	});

	describe('invalid_union errors', () => {
		it('should return INVALID_FORMAT for union type mismatch', () => {
			const schema = z.union([z.string(), z.number()]);
			const result = schema.safeParse({});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});
	});

	describe('invalid_value errors', () => {
		it('should return INVALID_FORMAT for enum mismatch', () => {
			const schema = z.enum(['a', 'b', 'c']);
			const result = schema.safeParse('d');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT for literal mismatch', () => {
			const schema = z.literal('expected');
			const result = schema.safeParse('actual');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});
	});

	describe('too_small errors', () => {
		it('should return INVALID_FORMAT for string too short', () => {
			const schema = z.string().min(5);
			const result = schema.safeParse('abc');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT for number too small', () => {
			const schema = z.number().min(10);
			const result = schema.safeParse(5);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT for array too short', () => {
			const schema = z.array(z.string()).min(3);
			const result = schema.safeParse(['a']);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_DATE_OF_BIRTH_FORMAT for date too early', () => {
			const minDate = new Date('2000-01-01');
			const schema = z.date().min(minDate);
			const result = schema.safeParse(new Date('1990-01-01'));

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_DATE_OF_BIRTH_FORMAT);
			}
		});
	});

	describe('too_big errors', () => {
		it('should return CONTENT_EXCEEDS_MAX_LENGTH for string too long', () => {
			const schema = z.string().max(5);
			const result = schema.safeParse('toolongstring');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.CONTENT_EXCEEDS_MAX_LENGTH);
			}
		});

		it('should return INVALID_FORMAT for number too large', () => {
			const schema = z.number().max(10);
			const result = schema.safeParse(100);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT for array too long', () => {
			const schema = z.array(z.string()).max(2);
			const result = schema.safeParse(['a', 'b', 'c', 'd']);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return SCHEDULED_TIME_MUST_BE_FUTURE for date too late', () => {
			const maxDate = new Date('2000-01-01');
			const schema = z.date().max(maxDate);
			const result = schema.safeParse(new Date('2025-01-01'));

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.SCHEDULED_TIME_MUST_BE_FUTURE);
			}
		});
	});

	describe('invalid_format errors', () => {
		it('should return INVALID_EMAIL_ADDRESS for invalid email', () => {
			const schema = z.email();
			const result = schema.safeParse('not-an-email');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_EMAIL_ADDRESS);
			}
		});

		it('should return INVALID_SNOWFLAKE for invalid uuid', () => {
			const schema = z.string().uuid();
			const result = schema.safeParse('not-a-uuid');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_SNOWFLAKE);
			}
		});

		it('should return INVALID_FORMAT for invalid url', () => {
			const schema = z.url();
			const result = schema.safeParse('not-a-url');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});
	});

	describe('not_multiple_of errors', () => {
		it('should return INVALID_FORMAT for number not multiple of', () => {
			const schema = z.number().multipleOf(5);
			const result = schema.safeParse(7);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});
	});

	describe('custom errors', () => {
		it('should use error_code from params when provided', () => {
			const schema = z.string().refine(() => false, {
				params: {error_code: ValidationErrorCodes.USERNAME_LENGTH_INVALID},
			});
			const result = schema.safeParse('test');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.USERNAME_LENGTH_INVALID);
			}
		});

		it('should return INVALID_FORMAT when error_code is not a valid ValidationErrorCode', () => {
			const schema = z.string().refine(() => false, {
				params: {error_code: 'SOME_INVALID_CODE'},
			});
			const result = schema.safeParse('test');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT when params has no error_code', () => {
			const schema = z.string().refine(() => false, {
				params: {other: 'value'},
			});
			const result = schema.safeParse('test');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should return INVALID_FORMAT when error_code is not a string', () => {
			const schema = z.string().refine(() => false, {
				params: {error_code: 123},
			});
			const result = schema.safeParse('test');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});
	});

	describe('validation error code as message', () => {
		it('should preserve validation error code when used as message directly', () => {
			const schema = z.string().refine(() => false, {
				message: ValidationErrorCodes.PASSWORD_LENGTH_INVALID,
			});
			const result = schema.safeParse('test');

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.PASSWORD_LENGTH_INVALID);
			}
		});
	});

	describe('complex schema validation', () => {
		it('should handle nested object validation', () => {
			const schema = z.object({
				user: z.object({
					email: z.email(),
					age: z.number().min(18),
				}),
			});
			const result = schema.safeParse({
				user: {
					email: 'invalid',
					age: 10,
				},
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.length).toBe(2);
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_EMAIL_ADDRESS);
				expect(result.error.issues[1].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
			}
		});

		it('should handle array element validation', () => {
			const schema = z.array(z.email());
			const result = schema.safeParse(['valid@email.com', 'invalid', 'also@valid.com']);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_EMAIL_ADDRESS);
			}
		});
	});
});

describe('initializeFluxerErrorMap', () => {
	it('should set custom error map globally', () => {
		initializeFluxerErrorMap();

		const schema = z.string().min(10);
		const result = schema.safeParse('short');

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.INVALID_FORMAT);
		}
	});
});
