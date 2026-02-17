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

import {buildEnvOverrides, parseEnvValue, setNestedValue} from '@fluxer/config/src/config_loader/EnvironmentOverrides';
import {describe, expect, test} from 'vitest';

describe('parseEnvValue', () => {
	test('parses boolean true', () => {
		expect(parseEnvValue('true')).toBe(true);
		expect(parseEnvValue(' true ')).toBe(true);
	});

	test('parses boolean false', () => {
		expect(parseEnvValue('false')).toBe(false);
		expect(parseEnvValue(' false ')).toBe(false);
	});

	test('parses integers', () => {
		expect(parseEnvValue('42')).toBe(42);
		expect(parseEnvValue('-7')).toBe(-7);
		expect(parseEnvValue('0')).toBe(0);
	});

	test('parses floats', () => {
		expect(parseEnvValue('3.14')).toBe(3.14);
		expect(parseEnvValue('-0.5')).toBe(-0.5);
	});

	test('parses JSON objects', () => {
		expect(parseEnvValue('{"key": "value"}')).toEqual({key: 'value'});
	});

	test('parses JSON arrays', () => {
		expect(parseEnvValue('[1, 2, 3]')).toEqual([1, 2, 3]);
	});

	test('returns raw string for invalid JSON-like values', () => {
		expect(parseEnvValue('{not json}')).toBe('{not json}');
	});

	test('returns raw string for plain strings', () => {
		expect(parseEnvValue('hello')).toBe('hello');
		expect(parseEnvValue('localhost')).toBe('localhost');
	});
});

describe('setNestedValue', () => {
	test('sets a top-level key', () => {
		const target: Record<string, unknown> = {};
		setNestedValue(target, ['port'], 8080);
		expect(target).toEqual({port: 8080});
	});

	test('sets a nested key', () => {
		const target: Record<string, unknown> = {};
		setNestedValue(target, ['database', 'host'], 'localhost');
		expect(target).toEqual({database: {host: 'localhost'}});
	});

	test('sets a deeply nested key', () => {
		const target: Record<string, unknown> = {};
		setNestedValue(target, ['a', 'b', 'c'], 'deep');
		expect(target).toEqual({a: {b: {c: 'deep'}}});
	});

	test('does nothing for empty keys', () => {
		const target: Record<string, unknown> = {existing: true};
		setNestedValue(target, [], 'value');
		expect(target).toEqual({existing: true});
	});

	test('overwrites non-object intermediate values', () => {
		const target: Record<string, unknown> = {a: 'string'};
		setNestedValue(target, ['a', 'b'], 'nested');
		expect(target).toEqual({a: {b: 'nested'}});
	});
});

describe('buildEnvOverrides', () => {
	test('extracts env vars with the given prefix', () => {
		const env = {
			FLUXER_CONFIG__ENV: 'production',
			FLUXER_CONFIG__DATABASE__HOST: 'db.example.com',
			UNRELATED_VAR: 'ignored',
		} as NodeJS.ProcessEnv;

		const result = buildEnvOverrides(env, 'FLUXER_CONFIG__');
		expect(result).toEqual({
			env: 'production',
			database: {host: 'db.example.com'},
		});
	});

	test('lowercases key segments', () => {
		const env = {
			FLUXER_CONFIG__DATABASE__PORT: '5432',
		} as NodeJS.ProcessEnv;

		const result = buildEnvOverrides(env, 'FLUXER_CONFIG__');
		expect(result).toEqual({database: {port: 5432}});
	});

	test('skips keys that are exactly the prefix with no remainder', () => {
		const env = {
			FLUXER_CONFIG__: 'ignored',
		} as NodeJS.ProcessEnv;

		const result = buildEnvOverrides(env, 'FLUXER_CONFIG__');
		expect(result).toEqual({});
	});

	test('skips undefined values', () => {
		const env = {
			FLUXER_CONFIG__MISSING: undefined,
		} as NodeJS.ProcessEnv;

		const result = buildEnvOverrides(env, 'FLUXER_CONFIG__');
		expect(result).toEqual({});
	});

	test('supports custom prefix', () => {
		const env = {
			MYAPP__PORT: '3000',
		} as NodeJS.ProcessEnv;

		const result = buildEnvOverrides(env, 'MYAPP__');
		expect(result).toEqual({port: 3000});
	});

	test('returns empty object when no matching vars exist', () => {
		const env = {
			UNRELATED: 'value',
		} as NodeJS.ProcessEnv;

		const result = buildEnvOverrides(env, 'FLUXER_CONFIG__');
		expect(result).toEqual({});
	});
});
