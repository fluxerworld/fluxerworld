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
import type {ILimitEvaluator} from '@fluxer/limits/src/ILimitEvaluator';
import {DEFAULT_FREE_LIMITS} from '@fluxer/limits/src/LimitDefaults';
import {applyRuleToResolvedLimits, ruleMatches, sortRulesBySpecificity} from '@fluxer/limits/src/LimitRuleRuntime';
import type {
	LimitConfigSnapshot,
	LimitEvaluationOptions,
	LimitEvaluationResult,
	LimitMatchContext,
	LimitRule,
} from '@fluxer/limits/src/LimitTypes';

export class LimitEvaluator implements ILimitEvaluator {
	private readonly sortedRules: Array<LimitRule>;

	constructor(snapshot: LimitConfigSnapshot) {
		this.sortedRules = sortRulesBySpecificity(snapshot.rules);
	}

	resolveAll(ctx: LimitMatchContext, options?: LimitEvaluationOptions): LimitEvaluationResult {
		const evaluationContext = options?.evaluationContext ?? 'user';
		const baseLimits = options?.baseLimits ?? DEFAULT_FREE_LIMITS;
		const resolvedLimits = {...baseLimits};

		for (const rule of this.sortedRules) {
			if (!ruleMatches(rule.filters, ctx)) {
				continue;
			}

			applyRuleToResolvedLimits(resolvedLimits, rule, evaluationContext);
		}

		return {
			limits: resolvedLimits,
		};
	}

	resolveOne(ctx: LimitMatchContext, key: LimitKey, options?: LimitEvaluationOptions): number {
		return this.resolveAll(ctx, options).limits[key];
	}
}
