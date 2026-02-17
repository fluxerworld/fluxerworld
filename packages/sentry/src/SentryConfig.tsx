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

import type {SentryBuildContext, SentryClientInitConfig, SentryConfig} from '@fluxer/sentry/src/SentryContracts';

const DEFAULT_ENVIRONMENT = 'production';
const DEFAULT_PRODUCTION_SAMPLE_RATE = 0.1;
const DEFAULT_NON_PRODUCTION_SAMPLE_RATE = 1.0;

export function resolveSentryInitConfig(config?: SentryConfig): SentryClientInitConfig | null {
	const normalizedDsn = config?.dsn?.trim();
	if (!normalizedDsn) {
		return null;
	}

	const environment = resolveEnvironment(config?.environment);
	const buildContext = resolveBuildContext(config);

	return {
		dsn: normalizedDsn,
		environment,
		...(config?.release !== undefined && {release: config.release}),
		...(buildContext.number !== undefined && {dist: buildContext.number}),
		...(config?.serviceName !== undefined && {serviceName: config.serviceName}),
		sampleRate: resolveSampleRate(config?.sampleRate, environment),
		buildContext,
	};
}

function resolveEnvironment(environment?: string): string {
	const trimmedEnvironment = environment?.trim();
	if (trimmedEnvironment && trimmedEnvironment.length > 0) {
		return trimmedEnvironment;
	}

	return DEFAULT_ENVIRONMENT;
}

function resolveSampleRate(sampleRate: number | undefined, environment: string): number {
	if (isValidSampleRate(sampleRate)) {
		return sampleRate;
	}

	if (environment === DEFAULT_ENVIRONMENT) {
		return DEFAULT_PRODUCTION_SAMPLE_RATE;
	}

	return DEFAULT_NON_PRODUCTION_SAMPLE_RATE;
}

function isValidSampleRate(sampleRate: number | undefined): sampleRate is number {
	return typeof sampleRate === 'number' && Number.isFinite(sampleRate) && sampleRate >= 0 && sampleRate <= 1;
}

function resolveBuildContext(config?: SentryConfig): SentryBuildContext {
	return {
		...(config?.buildSha !== undefined && {sha: config.buildSha}),
		...(config?.buildNumber !== undefined && {number: config.buildNumber}),
		...(config?.buildTimestamp !== undefined && {timestamp: config.buildTimestamp}),
		...(config?.releaseChannel !== undefined && {channel: config.releaseChannel}),
	};
}
