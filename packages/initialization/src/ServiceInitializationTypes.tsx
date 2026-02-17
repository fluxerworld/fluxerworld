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

import type {InstrumentationConfig} from '@fluxer/telemetry/src/Telemetry';

export interface ServiceInitConfig {
	serviceName: string;
	serviceVersion?: string;
	environment?: string;
	telemetry?: TelemetryInitConfig;
	sentry?: SentryInitConfig;
}

export interface TelemetryInitConfig {
	enabled?: boolean;
	otlpEndpoint?: string;
	apiKey?: string;
	traceSamplingRatio?: number;
	metricExportIntervalMs?: number;
	ignoreIncomingPaths?: Array<string>;
	instrumentations?: InstrumentationConfig;
}

export interface SentryInitConfig {
	enabled?: boolean;
	dsn?: string;
	sampleRate?: number;
	buildSha?: string;
	buildNumber?: string;
	buildTimestamp?: string;
	releaseChannel?: string;
}

export type ShutdownFn = () => Promise<void>;
