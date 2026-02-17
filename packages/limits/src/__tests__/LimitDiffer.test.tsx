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

import {DEFAULT_FREE_LIMITS, DEFAULT_PREMIUM_LIMITS} from '@fluxer/limits/src/LimitDefaults';
import {computeOverrides, computeWireFormat, expandWireFormat} from '@fluxer/limits/src/LimitDiffer';
import type {LimitConfigSnapshot} from '@fluxer/limits/src/LimitTypes';
import {describe, expect, test} from 'vitest';

describe('LimitDiffer', () => {
	test('computeOverrides returns empty object when limits match defaults', () => {
		const overrides = computeOverrides(DEFAULT_FREE_LIMITS, DEFAULT_FREE_LIMITS);
		expect(overrides).toEqual({});
	});

	test('computeOverrides extracts differences from defaults', () => {
		const customLimits = {
			...DEFAULT_FREE_LIMITS,
			max_guilds: 150,
			max_message_length: 3000,
		};

		const overrides = computeOverrides(customLimits, DEFAULT_FREE_LIMITS);

		expect(overrides).toEqual({
			max_guilds: 150,
			max_message_length: 3000,
		});
	});

	test('computeWireFormat creates wire format with overrides', () => {
		const config: LimitConfigSnapshot = {
			traitDefinitions: ['premium'],
			rules: [
				{
					id: 'default',
					limits: {...DEFAULT_FREE_LIMITS},
				},
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {...DEFAULT_PREMIUM_LIMITS},
				},
			],
		};

		const wireFormat = computeWireFormat(config);

		expect(wireFormat.version).toBe(2);
		expect(wireFormat.traitDefinitions).toEqual(['premium']);
		expect(wireFormat.rules).toHaveLength(2);
		expect(wireFormat.defaultsHash).toBeTruthy();

		expect(wireFormat.rules[0].id).toBe('default');
		expect(wireFormat.rules[0].overrides).toEqual({});

		expect(wireFormat.rules[1].id).toBe('premium');
		expect(Object.keys(wireFormat.rules[1].overrides).length).toBeGreaterThan(0);
		expect(wireFormat.rules[1].overrides.max_guilds).toBe(200);
	});

	test('expandWireFormat reconstructs full config from overrides', () => {
		const config: LimitConfigSnapshot = {
			traitDefinitions: ['premium'],
			rules: [
				{
					id: 'default',
					limits: {...DEFAULT_FREE_LIMITS},
				},
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {...DEFAULT_PREMIUM_LIMITS},
				},
			],
		};

		const wireFormat = computeWireFormat(config);
		const expanded = expandWireFormat(wireFormat);

		expect(expanded.version).toBe(2);
		expect(expanded.traitDefinitions).toEqual(['premium']);
		expect(expanded.rules).toHaveLength(2);

		expect(expanded.rules[0].limits.max_guilds).toBe(100);
		expect(expanded.rules[1].limits.max_guilds).toBe(200);
		expect(expanded.rules[1].limits.max_message_length).toBe(4000);
	});

	test('roundtrip: expand(compute(config)) equals config', () => {
		const config: LimitConfigSnapshot = {
			traitDefinitions: ['premium'],
			rules: [
				{
					id: 'default',
					limits: {...DEFAULT_FREE_LIMITS},
				},
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {
						...DEFAULT_PREMIUM_LIMITS,
						max_guilds: 250,
					},
				},
			],
		};

		const wireFormat = computeWireFormat(config);
		const expanded = expandWireFormat(wireFormat);

		expect(expanded.rules[0].limits).toEqual(config.rules[0].limits);
		expect(expanded.rules[1].limits.max_guilds).toBe(250);
		expect(expanded.rules[1].limits.max_message_length).toBe(4000);
	});
});
