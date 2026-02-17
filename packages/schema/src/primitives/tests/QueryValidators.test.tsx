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
import {createQueryIntegerType, DateTimeType, QueryBooleanType} from '@fluxer/schema/src/primitives/QueryValidators';
import {describe, expect, it} from 'vitest';

describe('QueryBooleanType', () => {
	it('parses "true" as true', () => {
		const result = QueryBooleanType.safeParse('true');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(true);
		}
	});

	it('parses "True" as true', () => {
		const result = QueryBooleanType.safeParse('True');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(true);
		}
	});

	it('parses "1" as true', () => {
		const result = QueryBooleanType.safeParse('1');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(true);
		}
	});

	it('parses "false" as false', () => {
		const result = QueryBooleanType.safeParse('false');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(false);
		}
	});

	it('parses "0" as false', () => {
		const result = QueryBooleanType.safeParse('0');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(false);
		}
	});

	it('defaults to false when undefined', () => {
		const result = QueryBooleanType.safeParse(undefined);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(false);
		}
	});

	it('parses any other string as false', () => {
		const result = QueryBooleanType.safeParse('yes');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(false);
		}
	});

	it('trims whitespace', () => {
		const result = QueryBooleanType.safeParse('  true  ');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(true);
		}
	});
});

describe('createQueryIntegerType', () => {
	it('parses valid integer strings', () => {
		const IntType = createQueryIntegerType();
		const result = IntType.safeParse('42');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(42);
		}
	});

	it('uses default value when undefined', () => {
		const IntType = createQueryIntegerType({defaultValue: 10});
		const result = IntType.safeParse(undefined);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(10);
		}
	});

	it('respects minimum value', () => {
		const IntType = createQueryIntegerType({minValue: 5});
		const result = IntType.safeParse('3');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.VALUE_MUST_BE_INTEGER_IN_RANGE);
		}
	});

	it('respects maximum value', () => {
		const IntType = createQueryIntegerType({maxValue: 100});
		const result = IntType.safeParse('150');
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(ValidationErrorCodes.VALUE_MUST_BE_INTEGER_IN_RANGE);
		}
	});

	it('accepts value at minimum', () => {
		const IntType = createQueryIntegerType({minValue: 5});
		const result = IntType.safeParse('5');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(5);
		}
	});

	it('accepts value at maximum', () => {
		const IntType = createQueryIntegerType({maxValue: 100});
		const result = IntType.safeParse('100');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(100);
		}
	});

	it('rejects non-integer strings', () => {
		const IntType = createQueryIntegerType();
		const result = IntType.safeParse('not-a-number');
		expect(result.success).toBe(false);
	});

	it('rejects floating point strings', () => {
		const IntType = createQueryIntegerType();
		const result = IntType.safeParse('3.14');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(3);
		}
	});

	it('trims whitespace', () => {
		const IntType = createQueryIntegerType();
		const result = IntType.safeParse('  42  ');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(42);
		}
	});

	it('handles zero correctly', () => {
		const IntType = createQueryIntegerType();
		const result = IntType.safeParse('0');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe(0);
		}
	});
});

describe('DateTimeType', () => {
	it('accepts valid ISO timestamp strings', () => {
		const result = DateTimeType.safeParse('2024-01-15T12:30:00Z');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeInstanceOf(Date);
			expect(result.data.toISOString()).toBe('2024-01-15T12:30:00.000Z');
		}
	});

	it('accepts ISO timestamps with milliseconds', () => {
		const result = DateTimeType.safeParse('2024-01-15T12:30:00.123Z');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeInstanceOf(Date);
		}
	});

	it('accepts ISO timestamps with timezone offset', () => {
		const result = DateTimeType.safeParse('2024-01-15T12:30:00+05:00');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeInstanceOf(Date);
		}
	});

	it('accepts ISO timestamps with negative timezone offset', () => {
		const result = DateTimeType.safeParse('2024-01-15T12:30:00-08:00');
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeInstanceOf(Date);
		}
	});

	it('accepts valid Unix timestamps as numbers', () => {
		const result = DateTimeType.safeParse(1705323000000);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeInstanceOf(Date);
		}
	});

	it('accepts zero timestamp', () => {
		const result = DateTimeType.safeParse(0);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBeInstanceOf(Date);
			expect(result.data.getTime()).toBe(0);
		}
	});

	it('rejects invalid ISO timestamp format', () => {
		const result = DateTimeType.safeParse('2024-01-15 12:30:00');
		expect(result.success).toBe(false);
	});

	it('rejects non-date strings', () => {
		const result = DateTimeType.safeParse('not-a-date');
		expect(result.success).toBe(false);
	});

	it('rejects negative timestamps', () => {
		const result = DateTimeType.safeParse(-1);
		expect(result.success).toBe(false);
	});

	it('rejects timestamps exceeding maximum', () => {
		const result = DateTimeType.safeParse(8640000000000001);
		expect(result.success).toBe(false);
	});

	it('accepts maximum valid timestamp', () => {
		const result = DateTimeType.safeParse(8640000000000000);
		expect(result.success).toBe(true);
	});

	it('rejects floating point timestamps', () => {
		const result = DateTimeType.safeParse(1705323000000.5);
		expect(result.success).toBe(false);
	});
});
