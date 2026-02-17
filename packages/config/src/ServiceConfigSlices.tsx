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

import {getBuildMetadata} from '@fluxer/config/src/BuildMetadata';
import type {MasterConfig} from '@fluxer/config/src/MasterZodSchema.generated';

export function extractBaseServiceConfig(master: MasterConfig) {
	return {
		env: master.env,
		telemetry: master.telemetry,
		sentry: master.sentry,
	};
}

export function extractKVClientConfig(master: MasterConfig) {
	if (!master.internal) {
		throw new Error('internal configuration is required for KV client access (microservices mode only)');
	}
	return {
		kvUrl: master.internal.kv,
	};
}

export function extractBuildInfoConfig() {
	const metadata = getBuildMetadata();
	return {
		releaseChannel: metadata.releaseChannel,
		buildTimestamp: metadata.buildTimestamp,
	};
}

export function extractRateLimit(
	rawRateLimit: {limit?: number | null; window_ms?: number | null} | null | undefined,
): {limit: number; windowMs: number} | undefined {
	if (!rawRateLimit || rawRateLimit.limit == null || rawRateLimit.window_ms == null) {
		return undefined;
	}
	return {
		limit: rawRateLimit.limit,
		windowMs: rawRateLimit.window_ms,
	};
}
