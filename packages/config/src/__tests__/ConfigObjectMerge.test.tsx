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

import {deepMerge, isPlainObject} from '@fluxer/config/src/config_loader/ConfigObjectMerge';
import {describe, expect, test} from 'vitest';

describe('isPlainObject', () => {
	test('returns true for plain objects', () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject({a: 1})).toBe(true);
	});

	test('returns false for arrays', () => {
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject([1, 2])).toBe(false);
	});

	test('returns false for null and primitives', () => {
		expect(isPlainObject(null)).toBe(false);
		expect(isPlainObject(undefined)).toBe(false);
		expect(isPlainObject(42)).toBe(false);
		expect(isPlainObject('string')).toBe(false);
		expect(isPlainObject(true)).toBe(false);
	});
});

describe('deepMerge', () => {
	test('merges flat objects', () => {
		const result = deepMerge({a: 1, b: 2}, {b: 3, c: 4});
		expect(result).toEqual({a: 1, b: 3, c: 4});
	});

	test('merges nested objects recursively', () => {
		const target = {database: {host: 'localhost', port: 5432}};
		const source = {database: {port: 3306, name: 'test'}};
		const result = deepMerge(target, source);
		expect(result).toEqual({database: {host: 'localhost', port: 3306, name: 'test'}});
	});

	test('replaces arrays instead of merging them', () => {
		const target = {tags: ['a', 'b']};
		const source = {tags: ['c']};
		const result = deepMerge(target, source);
		expect(result).toEqual({tags: ['c']});
	});

	test('source overrides target for non-object values', () => {
		const target = {a: 'old', b: {nested: true}};
		const source = {a: 'new', b: 'replaced'};
		const result = deepMerge(target, source);
		expect(result).toEqual({a: 'new', b: 'replaced'});
	});

	test('does not mutate the target', () => {
		const target = {a: 1, nested: {b: 2}};
		const source = {a: 99, nested: {c: 3}};
		deepMerge(target, source);
		expect(target).toEqual({a: 1, nested: {b: 2}});
	});

	test('handles empty objects', () => {
		expect(deepMerge({}, {a: 1})).toEqual({a: 1});
		expect(deepMerge({a: 1}, {})).toEqual({a: 1});
		expect(deepMerge({}, {})).toEqual({});
	});
});
