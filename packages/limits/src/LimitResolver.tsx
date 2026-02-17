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
import {LimitEvaluator} from '@fluxer/limits/src/LimitEvaluator';
import type {
	LimitConfigSnapshot,
	LimitEvaluationOptions,
	LimitEvaluationResult,
	LimitMatchContext,
} from '@fluxer/limits/src/LimitTypes';

export function createLimitEvaluator(snapshot: LimitConfigSnapshot): ILimitEvaluator {
	return new LimitEvaluator(snapshot);
}

export function resolveLimits(
	snapshot: LimitConfigSnapshot,
	ctx: LimitMatchContext,
	options?: LimitEvaluationOptions,
): LimitEvaluationResult {
	const evaluator = createLimitEvaluator(snapshot);
	return evaluator.resolveAll(ctx, options);
}

export function resolveLimit(
	snapshot: LimitConfigSnapshot,
	ctx: LimitMatchContext,
	key: LimitKey,
	options?: LimitEvaluationOptions,
): number {
	const evaluator = createLimitEvaluator(snapshot);
	return evaluator.resolveOne(ctx, key, options);
}
