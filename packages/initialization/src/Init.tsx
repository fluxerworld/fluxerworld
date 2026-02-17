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

import {getSentryBuildContext, getServiceVersionLabel} from '@fluxer/config/src/BuildMetadata';
import type {ServiceInitConfig, ShutdownFn} from '@fluxer/initialization/src/ServiceInitializationTypes';
import {flushSentry, initSentry} from '@fluxer/sentry/src/Sentry';
import type {SentryConfig} from '@fluxer/sentry/src/SentryContracts';
import {
	initializeTelemetry,
	shouldInitializeTelemetry,
	shutdownTelemetry,
	type TelemetryConfig,
} from '@fluxer/telemetry/src/Telemetry';

const SENTRY_FLUSH_TIMEOUT_MS = 2000;

let initialized = false;

export async function initializeService(config: ServiceInitConfig): Promise<void> {
	if (initialized) {
		return;
	}

	const {serviceName, environment = 'production', telemetry, sentry} = config;
	const serviceVersion = config.serviceVersion ?? getServiceVersionLabel();

	if (telemetry?.enabled ?? shouldInitializeTelemetry()) {
		const telemetryConfig: Partial<TelemetryConfig> = {
			serviceName,
			serviceVersion,
			environment,
			otlpEndpoint: telemetry?.otlpEndpoint,
			otlpApiKey: telemetry?.apiKey,
			traceSamplingRatio: telemetry?.traceSamplingRatio,
			metricExportIntervalMs: telemetry?.metricExportIntervalMs,
			ignoreIncomingPaths: telemetry?.ignoreIncomingPaths,
			instrumentations: telemetry?.instrumentations,
		};

		await initializeTelemetry(telemetryConfig);
	}

	if (sentry?.enabled && sentry.dsn) {
		const buildContext = getSentryBuildContext();
		const sentryConfig: SentryConfig = {
			dsn: sentry.dsn,
			serviceName,
			environment,
			release: serviceVersion !== undefined ? `${serviceName}@${serviceVersion}` : undefined,
			sampleRate: sentry.sampleRate,
			buildSha: sentry.buildSha ?? buildContext.buildSha,
			buildNumber: sentry.buildNumber ?? buildContext.buildNumber,
			buildTimestamp: sentry.buildTimestamp ?? buildContext.buildTimestamp,
			releaseChannel: sentry.releaseChannel ?? buildContext.releaseChannel,
		};

		initSentry(sentryConfig);
	}

	initialized = true;
}

export async function shutdownService(): Promise<void> {
	if (!initialized) {
		return;
	}

	await flushSentry(SENTRY_FLUSH_TIMEOUT_MS);
	await shutdownTelemetry();

	initialized = false;
}

export function isServiceInitialized(): boolean {
	return initialized;
}

export function startServiceInitialization(config: ServiceInitConfig): ShutdownFn {
	initializeService(config).catch((err: unknown) => {
		process.stderr.write(`[instrument] Failed to initialize instrumentation: ${err}\n`);
	});

	return shutdownService;
}
