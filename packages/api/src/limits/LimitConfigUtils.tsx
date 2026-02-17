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
import {resolveLimit} from '@fluxer/limits/src/LimitResolver';
import type {EvaluationContext, LimitConfigSnapshot, LimitMatchContext} from '@fluxer/limits/src/LimitTypes';

export function resolveLimitSafe(
	snapshot: LimitConfigSnapshot | null | undefined,
	ctx: LimitMatchContext,
	key: LimitKey,
	fallback: number,
	evaluationContext: EvaluationContext = 'user',
): number {
	if (!snapshot) {
		return fallback;
	}

	const resolved = resolveLimit(snapshot, ctx, key, {evaluationContext});
	if (Number.isFinite(resolved) && resolved >= 0) {
		return resolved;
	}
	return fallback;
}
