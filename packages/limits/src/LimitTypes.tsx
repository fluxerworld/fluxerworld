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

export interface LimitFilter {
	traits?: Array<string>;
	guildFeatures?: Array<string>;
}

export interface LimitRule {
	id: string;
	filters?: LimitFilter;
	limits: Partial<Record<LimitKey, number>>;
	modifiedFields?: Array<LimitKey>;
}

export interface LimitConfigSnapshot {
	version?: number;
	traitDefinitions: Array<string>;
	rules: Array<LimitRule>;
}

export interface LimitConfigWireFormat {
	version: 2;
	traitDefinitions: Array<string>;
	rules: Array<{
		id: string;
		filters?: LimitFilter;
		overrides: Partial<Record<LimitKey, number>>;
	}>;
	defaultsHash: string;
}

export interface LimitMatchContext {
	traits: Set<string>;
	guildFeatures: Set<string>;
}

export type EvaluationContext = 'user' | 'guild';

export interface LimitEvaluationOptions {
	evaluationContext?: EvaluationContext;
	baseLimits?: Record<LimitKey, number>;
}

export interface LimitEvaluationResult {
	limits: Record<LimitKey, number>;
}
