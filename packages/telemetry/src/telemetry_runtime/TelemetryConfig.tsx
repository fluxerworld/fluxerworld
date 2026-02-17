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

import {hostname} from 'node:os';
import type {OtlpConfig, TelemetryConfig} from '@fluxer/telemetry/src/Telemetry';

function assertPositiveNumber(value: number, fieldName: string): void {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`Telemetry config "${fieldName}" must be a positive number`);
	}
}

function normalizeEndpoint(endpoint: string): string {
	const trimmedEndpoint = endpoint.trim();
	return trimmedEndpoint.replace(/\/+$/, '');
}

function normalizeIgnoreIncomingPaths(paths: Array<string>): Array<string> {
	const pathSet = new Set<string>();
	for (const path of paths) {
		const normalizedPath = path.trim();
		if (normalizedPath.length === 0) {
			continue;
		}
		pathSet.add(normalizedPath);
	}
	return [...pathSet];
}

function validateTelemetryConfig(config: TelemetryConfig): void {
	if (config.serviceName.trim().length === 0) {
		throw new Error('Telemetry config "serviceName" must not be empty');
	}
	if (config.serviceVersion.trim().length === 0) {
		throw new Error('Telemetry config "serviceVersion" must not be empty');
	}
	if (config.environment.trim().length === 0) {
		throw new Error('Telemetry config "environment" must not be empty');
	}
	if (config.enabled && config.otlpEndpoint.length === 0) {
		throw new Error('Telemetry config "otlpEndpoint" must not be empty when telemetry is enabled');
	}
	if (!Number.isFinite(config.traceSamplingRatio) || config.traceSamplingRatio < 0 || config.traceSamplingRatio > 1) {
		throw new Error('Telemetry config "traceSamplingRatio" must be between 0 and 1');
	}
	assertPositiveNumber(config.exportTimeout, 'exportTimeout');
	assertPositiveNumber(config.metricExportIntervalMs, 'metricExportIntervalMs');
}

export function getDefaultTelemetryConfig(): TelemetryConfig {
	return {
		enabled: false,
		serviceName: 'fluxer',
		serviceVersion: 'unknown',
		serviceInstanceId: hostname(),
		environment: 'development',
		traceSamplingRatio: 1.0,
		otlpEndpoint: '',
		exportTimeout: 30000,
		metricExportIntervalMs: 60000,
		ignoreIncomingPaths: ['/_health'],
	};
}

export function resolveTelemetryConfig(config?: Partial<TelemetryConfig>): TelemetryConfig {
	const defaults = getDefaultTelemetryConfig();
	const defined = Object.fromEntries(
		Object.entries(config ?? {}).filter(([, v]) => v !== undefined),
	) as Partial<TelemetryConfig>;
	const mergedConfig: TelemetryConfig = {
		...defaults,
		...defined,
		otlpEndpoint: normalizeEndpoint(config?.otlpEndpoint ?? defaults.otlpEndpoint),
		ignoreIncomingPaths: normalizeIgnoreIncomingPaths(config?.ignoreIncomingPaths ?? defaults.ignoreIncomingPaths),
		instrumentations: config?.instrumentations === undefined ? defaults.instrumentations : {...config.instrumentations},
	};
	validateTelemetryConfig(mergedConfig);
	return mergedConfig;
}

export function cloneTelemetryConfig(config: TelemetryConfig): TelemetryConfig {
	return {
		...config,
		ignoreIncomingPaths: [...config.ignoreIncomingPaths],
		instrumentations: config.instrumentations === undefined ? undefined : {...config.instrumentations},
	};
}

export function createOtlpConfigFromTelemetryConfig(config: TelemetryConfig): OtlpConfig {
	const baseEndpoint = config.otlpEndpoint.replace(/\/+$/, '');
	const headers = config.otlpApiKey === undefined ? undefined : {Authorization: `Bearer ${config.otlpApiKey}`};

	return {
		endpoints: {
			traces: `${baseEndpoint}/v1/traces`,
			metrics: `${baseEndpoint}/v1/metrics`,
			logs: `${baseEndpoint}/v1/logs`,
		},
		...(headers !== undefined && {headers}),
	};
}
