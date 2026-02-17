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

import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import {recordCounter, recordGauge, recordHistogram} from '@fluxer/telemetry/src/Metrics';
import {isTelemetryActive} from '@fluxer/telemetry/src/Telemetry';
import {setSpanAttributes, withSpan} from '@fluxer/telemetry/src/Tracing';

export interface TelemetryTracingOptions {
	serviceName: string;
	skipPaths?: Array<string>;
	attachTraceparent?: boolean;
}

function createTelemetryMetricsCollector(): MetricsCollector {
	return {
		recordCounter: ({name, value, labels}: {name: string; value?: number; labels?: Record<string, string>}) => {
			if (!isTelemetryActive()) {
				return;
			}
			recordCounter(name, value ?? 1, labels);
		},
		recordHistogram: ({name, value, labels}: {name: string; value: number; labels?: Record<string, string>}) => {
			if (!isTelemetryActive()) {
				return;
			}
			recordHistogram(name, value, labels);
		},
		recordGauge: ({name, value, labels}: {name: string; value: number; labels?: Record<string, string>}) => {
			if (!isTelemetryActive()) {
				return;
			}
			recordGauge({name, value, dimensions: labels});
		},
	};
}

function createTelemetryTracingOptions(options: TelemetryTracingOptions): TracingOptions {
	return {
		enabled: isTelemetryActive(),
		serviceName: options.serviceName,
		skipPaths: options.skipPaths,
		attachTraceparent: options.attachTraceparent,
		withSpan: async (name: string, fn: () => Promise<void>) => {
			await withSpan(name, async () => {
				await fn();
				return undefined;
			});
		},
		setSpanAttributes: (attributes: Record<string, string | number | boolean>) => {
			setSpanAttributes(attributes);
		},
	};
}

export function createServiceTelemetry(options: TelemetryTracingOptions): {
	metricsCollector: MetricsCollector;
	tracing: TracingOptions;
} {
	return {
		metricsCollector: createTelemetryMetricsCollector(),
		tracing: createTelemetryTracingOptions(options),
	};
}
