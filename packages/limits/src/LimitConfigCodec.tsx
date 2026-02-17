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

import {LIMIT_KEYS, type LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import type {ILimitConfigCodec, LimitConfigCodecOptions} from '@fluxer/limits/src/ILimitConfigCodec';
import {DEFAULT_FREE_LIMITS} from '@fluxer/limits/src/LimitDefaults';
import {computeDefaultsHash} from '@fluxer/limits/src/LimitHashing';
import type {LimitConfigSnapshot, LimitConfigWireFormat} from '@fluxer/limits/src/LimitTypes';

export class LimitConfigCodec implements ILimitConfigCodec {
	computeOverrides(
		fullLimits: Partial<Record<LimitKey, number>>,
		defaults: Record<LimitKey, number>,
	): Partial<Record<LimitKey, number>> {
		const overrides: Partial<Record<LimitKey, number>> = {};

		for (const key of LIMIT_KEYS) {
			const value = fullLimits[key];
			if (value === undefined) {
				continue;
			}

			if (value !== defaults[key]) {
				overrides[key] = value;
			}
		}

		return overrides;
	}

	toWireFormat(config: LimitConfigSnapshot, options?: LimitConfigCodecOptions): LimitConfigWireFormat {
		const defaults = options?.defaults ?? DEFAULT_FREE_LIMITS;
		const defaultsHash = options?.defaultsHash ?? computeDefaultsHash();
		const rules = config.rules.map((rule) => {
			const overrides = this.computeOverrides(rule.limits, defaults);

			return {
				id: rule.id,
				filters: rule.filters,
				overrides,
			};
		});

		return {
			version: 2,
			traitDefinitions: config.traitDefinitions,
			rules,
			defaultsHash,
		};
	}

	fromWireFormat(wireFormat: LimitConfigWireFormat, options?: LimitConfigCodecOptions): LimitConfigSnapshot {
		const defaults = options?.defaults ?? DEFAULT_FREE_LIMITS;
		const rules = wireFormat.rules.map((rule) => {
			const limits: Partial<Record<LimitKey, number>> = {
				...defaults,
				...rule.overrides,
			};

			return {
				id: rule.id,
				filters: rule.filters,
				limits,
			};
		});

		return {
			version: wireFormat.version,
			traitDefinitions: wireFormat.traitDefinitions,
			rules,
		};
	}
}
