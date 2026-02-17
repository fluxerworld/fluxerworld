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

import InstanceConfigStore from '@app/stores/InstanceConfigStore';
import LimitOverrideStore from '@app/stores/LimitOverrideStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import type {LimitContextInput} from '@app/utils/limits/LimitContext';
import {LimitContext} from '@app/utils/limits/LimitContext';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {resolveLimit, resolveLimits} from '@fluxer/limits/src/LimitResolver';
import type {LimitConfigSnapshot} from '@fluxer/limits/src/LimitTypes';

export interface LimitResolveOptions {
	key: LimitKey;
	fallback: number;
	context?: LimitContextInput;
	instanceDomain?: string;
}

class LimitResolverClass {
	resolve(options: LimitResolveOptions): number {
		const {key, fallback, context, instanceDomain} = options;

		const override = LimitOverrideStore.getOverride(key);
		if (override !== null) {
			return override;
		}

		const snapshot = this.getSnapshotForInstance(instanceDomain);
		const ctx = context ? LimitContext.build(context) : LimitContext.current();

		const resolved = resolveLimit(snapshot, ctx, key);
		if (!Number.isFinite(resolved) || resolved < 0) {
			return fallback;
		}
		return Math.floor(resolved);
	}

	private getSnapshotForInstance(instanceDomain?: string): LimitConfigSnapshot {
		if (instanceDomain) {
			const instanceLimits = InstanceConfigStore.getLimitsForInstance(instanceDomain);
			if (instanceLimits) {
				return instanceLimits;
			}
		}
		return RuntimeConfigStore.limits;
	}

	resolveMultiple(
		keys: Array<LimitKey>,
		fallback: number,
		context?: LimitContextInput,
		instanceDomain?: string,
	): Record<string, number> {
		const snapshot = this.getSnapshotForInstance(instanceDomain);
		const ctx = context ? LimitContext.build(context) : LimitContext.current();

		const hasOverrides = LimitOverrideStore.hasOverrides();
		if (hasOverrides) {
			const result: Record<string, number> = {};
			for (const key of keys) {
				const override = LimitOverrideStore.getOverride(key);
				if (override !== null) {
					result[key] = override;
				} else {
					const resolved = resolveLimit(snapshot, ctx, key);
					result[key] = Number.isFinite(resolved) && resolved >= 0 ? Math.floor(resolved) : fallback;
				}
			}
			return result;
		}

		const {limits} = resolveLimits(snapshot, ctx);
		const result: Record<string, number> = {};
		for (const key of keys) {
			const resolved = limits[key];
			result[key] = Number.isFinite(resolved) && resolved >= 0 ? Math.floor(resolved) : fallback;
		}
		return result;
	}

	resolvePremium(key: LimitKey, fallback: number): number {
		return this.resolve({
			key,
			fallback,
			context: LimitContext.premium(),
		});
	}

	resolveFree(key: LimitKey, fallback: number): number {
		return this.resolve({
			key,
			fallback,
			context: LimitContext.free(),
		});
	}
}

export const LimitResolver = new LimitResolverClass();
