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

import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {LIMIT_KEYS} from '@fluxer/constants/src/LimitConfigMetadata';
import {DEFAULT_FREE_LIMITS, DEFAULT_PREMIUM_LIMITS} from '@fluxer/limits/src/LimitDefaults';
import type {LimitConfigSnapshot, LimitRule} from '@fluxer/limits/src/LimitTypes';

const LIMIT_RULE_IDS = {
	DEFAULT: 'default',
	PREMIUM: 'premium',
} as const;

export interface CachedLimitConfig {
	config: LimitConfigSnapshot;
	defaultsHash: string;
}

export function getLimitConfigKvKey(selfHosted: boolean): string {
	return `limit_config:${selfHosted ? 'self_hosted' : 'saas'}`;
}

export const LIMIT_CONFIG_REFRESH_CHANNEL = 'limit-config-refresh';
export const LIMIT_CONFIG_REFRESH_LOCK_KEY = 'limit-config-refresh-lock';

function cloneLimitConfigSnapshot(config: LimitConfigSnapshot): LimitConfigSnapshot {
	return structuredClone(config);
}

export function sanitizeLimitConfigForInstance(
	config: LimitConfigSnapshot,
	options?: {selfHosted?: boolean},
): LimitConfigSnapshot {
	const selfHosted = options?.selfHosted ?? false;
	const normalized: LimitConfigSnapshot = {
		traitDefinitions: Array.isArray(config.traitDefinitions) ? config.traitDefinitions : [],
		rules: Array.isArray(config.rules) ? config.rules : [],
	};

	if (!selfHosted) {
		return normalized;
	}

	const traitDefinitions = normalized.traitDefinitions.filter((t) => t !== 'premium');

	const rules = normalized.rules.filter((rule) => {
		const traits = rule.filters?.traits ?? [];
		return !traits.includes('premium');
	});

	return {
		traitDefinitions,
		rules,
	};
}

export function createDefaultLimitConfig(options?: {selfHosted?: boolean}): LimitConfigSnapshot {
	const selfHosted = options?.selfHosted ?? false;

	const hostedDefault: LimitConfigSnapshot = {
		traitDefinitions: selfHosted ? [] : ['premium'],
		rules: selfHosted
			? [
					{
						id: LIMIT_RULE_IDS.DEFAULT,
						limits: {...DEFAULT_PREMIUM_LIMITS},
					},
				]
			: [
					{
						id: LIMIT_RULE_IDS.PREMIUM,
						filters: {traits: ['premium']},
						limits: {...DEFAULT_PREMIUM_LIMITS},
					},
					{
						id: LIMIT_RULE_IDS.DEFAULT,
						limits: {...DEFAULT_FREE_LIMITS},
					},
				],
	};

	return sanitizeLimitConfigForInstance(cloneLimitConfigSnapshot(hostedDefault), {selfHosted});
}

export function mergeWithCurrentDefaults(
	stored: LimitConfigSnapshot,
	options?: {selfHosted?: boolean},
): LimitConfigSnapshot {
	const selfHosted = options?.selfHosted ?? false;
	const newDefaults = createDefaultLimitConfig({selfHosted});
	const mergedRules: Array<LimitRule> = [];

	const existingRulesMap = new Map<string, LimitRule>();
	for (const rule of stored.rules) {
		existingRulesMap.set(rule.id, rule);
	}

	for (const defaultRule of newDefaults.rules) {
		const existingRule = existingRulesMap.get(defaultRule.id);

		if (!existingRule) {
			mergedRules.push({...defaultRule});
			continue;
		}

		const mergedLimits: Partial<Record<LimitKey, number>> = {...defaultRule.limits};
		const modifiedFields: Array<LimitKey> = [];

		for (const key of LIMIT_KEYS) {
			const existingValue = existingRule.limits[key];
			const defaultValue = defaultRule.limits[key];

			if (existingValue !== undefined && existingValue !== defaultValue) {
				mergedLimits[key] = existingValue;
				modifiedFields.push(key);
			}
		}

		mergedRules.push({
			id: existingRule.id,
			filters: existingRule.filters ?? defaultRule.filters,
			limits: mergedLimits,
			modifiedFields: modifiedFields.length > 0 ? modifiedFields : undefined,
		});

		existingRulesMap.delete(defaultRule.id);
	}

	for (const [, rule] of existingRulesMap) {
		mergedRules.push({
			id: rule.id,
			filters: rule.filters,
			limits: rule.limits,
			modifiedFields: rule.modifiedFields ?? (Object.keys(rule.limits) as Array<LimitKey>),
		});
	}

	return {
		traitDefinitions: stored.traitDefinitions,
		rules: mergedRules,
	};
}
