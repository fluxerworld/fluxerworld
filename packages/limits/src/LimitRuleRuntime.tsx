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

import {LIMIT_KEY_SCOPES, LIMIT_KEYS, type LimitKey, type LimitScope} from '@fluxer/constants/src/LimitConfigMetadata';
import type {EvaluationContext, LimitFilter, LimitMatchContext, LimitRule} from '@fluxer/limits/src/LimitTypes';

interface RankedRule {
	rule: LimitRule;
	specificity: number;
	originalIndex: number;
}

function areRequiredEntriesPresent(required: Array<string> | undefined, available: Set<string>): boolean {
	if (!required || required.length === 0) {
		return true;
	}

	for (const entry of required) {
		if (!available.has(entry)) {
			return false;
		}
	}

	return true;
}

function shouldApplyLimitForContext(
	scope: LimitScope,
	evaluationContext: EvaluationContext,
	hasTraitFilters: boolean,
	hasGuildFilters: boolean,
): boolean {
	if (evaluationContext === 'user') {
		return scope === 'user' || scope === 'both';
	}

	if (scope === 'both') {
		return true;
	}

	if (scope === 'user') {
		return !hasGuildFilters;
	}

	if (hasGuildFilters) {
		return true;
	}

	return !hasTraitFilters;
}

function isValidLimitValue(value: number | undefined): value is number {
	if (typeof value !== 'number') {
		return false;
	}

	if (!Number.isFinite(value)) {
		return false;
	}

	return value >= 0;
}

export function ruleMatches(filters: LimitFilter | undefined, ctx: LimitMatchContext): boolean {
	if (!filters) {
		return true;
	}

	if (!areRequiredEntriesPresent(filters.traits, ctx.traits)) {
		return false;
	}

	if (!areRequiredEntriesPresent(filters.guildFeatures, ctx.guildFeatures)) {
		return false;
	}

	return true;
}

export function calculateSpecificity(filters: LimitFilter | undefined): number {
	if (!filters) {
		return 0;
	}

	const traitCount = filters.traits?.length ?? 0;
	const guildFeatureCount = filters.guildFeatures?.length ?? 0;
	return traitCount + guildFeatureCount;
}

export function compareSpecificity(a: LimitFilter | undefined, b: LimitFilter | undefined): number {
	return calculateSpecificity(a) - calculateSpecificity(b);
}

export function sortRulesBySpecificity(rules: Array<LimitRule>): Array<LimitRule> {
	const rankedRules: Array<RankedRule> = rules.map((rule, index) => ({
		rule,
		specificity: calculateSpecificity(rule.filters),
		originalIndex: index,
	}));

	rankedRules.sort((a, b) => {
		if (a.specificity !== b.specificity) {
			return a.specificity - b.specificity;
		}

		return a.originalIndex - b.originalIndex;
	});

	return rankedRules.map((rankedRule) => rankedRule.rule);
}

export function applyRuleToResolvedLimits(
	resolved: Record<LimitKey, number>,
	rule: LimitRule,
	evaluationContext: EvaluationContext,
): void {
	const hasGuildFilters = (rule.filters?.guildFeatures?.length ?? 0) > 0;
	const hasTraitFilters = (rule.filters?.traits?.length ?? 0) > 0;

	for (const key of LIMIT_KEYS) {
		const value = rule.limits[key];
		if (!isValidLimitValue(value)) {
			continue;
		}

		const scope = LIMIT_KEY_SCOPES[key];
		if (!shouldApplyLimitForContext(scope, evaluationContext, hasTraitFilters, hasGuildFilters)) {
			continue;
		}

		const currentValue = resolved[key] ?? 0;
		resolved[key] = Math.max(currentValue, value);
	}
}
