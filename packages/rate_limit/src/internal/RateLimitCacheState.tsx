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

import {assertPositiveFiniteNumber} from '@fluxer/rate_limit/src/internal/RateLimitValidation';

interface LegacyRateLimitCacheState {
	tat?: unknown;
	tat_ms?: unknown;
	limit?: unknown;
	window_ms?: unknown;
}

export interface RateLimitCacheState {
	tatMs: number;
	limit?: number;
	windowMs?: number;
}

interface SerializedRateLimitCacheState {
	tat: number;
	tat_ms: number;
	limit?: number;
	window_ms?: number;
}

function getOptionalPositiveFiniteNumber(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		return undefined;
	}

	return value;
}

function getTatMs(value: LegacyRateLimitCacheState): number | null {
	const tatMsCandidate = value.tat_ms ?? value.tat;
	if (typeof tatMsCandidate !== 'number' || !Number.isFinite(tatMsCandidate)) {
		return null;
	}

	return tatMsCandidate;
}

export function parseRateLimitCacheState(rawValue: unknown): RateLimitCacheState | null {
	if (!rawValue || typeof rawValue !== 'object') {
		return null;
	}

	const rawState = rawValue as LegacyRateLimitCacheState;
	const tatMs = getTatMs(rawState);
	if (tatMs === null) {
		return null;
	}

	return {
		tatMs,
		limit: getOptionalPositiveFiniteNumber(rawState.limit),
		windowMs: getOptionalPositiveFiniteNumber(rawState.window_ms),
	};
}

export function serializeRateLimitCacheState(state: RateLimitCacheState): SerializedRateLimitCacheState {
	assertPositiveFiniteNumber(state.tatMs, 'state.tatMs');

	const serializedState: SerializedRateLimitCacheState = {
		tat: state.tatMs,
		tat_ms: state.tatMs,
	};

	if (state.limit !== undefined) {
		assertPositiveFiniteNumber(state.limit, 'state.limit');
		serializedState.limit = state.limit;
	}

	if (state.windowMs !== undefined) {
		assertPositiveFiniteNumber(state.windowMs, 'state.windowMs');
		serializedState.window_ms = state.windowMs;
	}

	return serializedState;
}
