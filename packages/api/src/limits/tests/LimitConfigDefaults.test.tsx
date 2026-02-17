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

import {createDefaultLimitConfig, mergeWithCurrentDefaults} from '@fluxer/api/src/constants/LimitConfig';
import type {LimitConfigSnapshot} from '@fluxer/limits/src/LimitTypes';
import {describe, expect, test} from 'vitest';

describe('Limit config defaults', () => {
	test('hosted defaults include only premium and default tier limit rules', () => {
		const config = createDefaultLimitConfig({selfHosted: false});

		const premiumRule = config.rules.find((rule) => rule.id === 'premium');
		const defaultRule = config.rules.find((rule) => rule.id === 'default');

		expect(premiumRule).toBeDefined();
		expect(defaultRule).toBeDefined();
		expect(config.rules.map((rule) => rule.id)).toEqual(['premium', 'default']);
	});

	test('self-hosted defaults include only default tier limit rule', () => {
		const config = createDefaultLimitConfig({selfHosted: true});

		expect(config.rules.map((rule) => rule.id)).toEqual(['default']);
	});
});

describe('Limit config default merge', () => {
	test('legacy unlocked features on known rules are dropped during merge', () => {
		const legacyConfig = {
			traitDefinitions: ['premium'],
			rules: [
				{
					id: 'premium',
					filters: {traits: ['premium']},
					limits: {},
					unlockedFeatures: ['MORE_EMOJI', 'UNLIMITED_EMOJI'],
				},
				{
					id: 'default',
					limits: {},
				},
			],
		} as unknown as LimitConfigSnapshot;

		const merged = mergeWithCurrentDefaults(legacyConfig, {selfHosted: false});
		const premiumRule = merged.rules.find((rule) => rule.id === 'premium') as Record<string, unknown> | undefined;

		expect(premiumRule?.unlockedFeatures).toBeUndefined();
	});
});
