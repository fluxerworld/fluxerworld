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

import type {TelemetryConfig} from '@fluxer/telemetry/src/Telemetry';
import {createOtlpConfigFromTelemetryConfig} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryConfig';
import {createTelemetryInstrumentations} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryInstrumentations';
import type {ITelemetryInitLogger} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryLogger';
import {OTLPLogExporter} from '@opentelemetry/exporter-logs-otlp-http';
import {OTLPMetricExporter} from '@opentelemetry/exporter-metrics-otlp-http';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';
import {resourceFromAttributes} from '@opentelemetry/resources';
import {BatchLogRecordProcessor} from '@opentelemetry/sdk-logs';
import {PeriodicExportingMetricReader} from '@opentelemetry/sdk-metrics';
import {NodeSDK} from '@opentelemetry/sdk-node';
import {ParentBasedSampler, TraceIdRatioBasedSampler} from '@opentelemetry/sdk-trace-base';
import {
	SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
	SEMRESATTRS_SERVICE_INSTANCE_ID,
	SEMRESATTRS_SERVICE_NAME,
	SEMRESATTRS_SERVICE_NAMESPACE,
	SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export async function createTelemetrySdk(config: TelemetryConfig, logger: ITelemetryInitLogger): Promise<NodeSDK> {
	const otlpConfig = createOtlpConfigFromTelemetryConfig(config);
	const resource = resourceFromAttributes({
		[SEMRESATTRS_SERVICE_NAME]: config.serviceName,
		[SEMRESATTRS_SERVICE_NAMESPACE]: 'fluxer',
		[SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
		[SEMRESATTRS_SERVICE_INSTANCE_ID]: config.serviceInstanceId,
		[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment,
	});

	const traceExporter = new OTLPTraceExporter({
		url: otlpConfig.endpoints.traces,
		...(otlpConfig.headers !== undefined && {headers: otlpConfig.headers}),
		timeoutMillis: config.exportTimeout,
	});
	const metricExporter = new OTLPMetricExporter({
		url: otlpConfig.endpoints.metrics,
		...(otlpConfig.headers !== undefined && {headers: otlpConfig.headers}),
		timeoutMillis: config.exportTimeout,
	});
	const logExporter = new OTLPLogExporter({
		url: otlpConfig.endpoints.logs,
		...(otlpConfig.headers !== undefined && {headers: otlpConfig.headers}),
		timeoutMillis: config.exportTimeout,
	});

	const sampler = new ParentBasedSampler({
		root: new TraceIdRatioBasedSampler(config.traceSamplingRatio),
	});
	const instrumentations = await createTelemetryInstrumentations(config, logger);

	return new NodeSDK({
		resource,
		traceExporter,
		sampler,
		metricReader: new PeriodicExportingMetricReader({
			exporter: metricExporter,
			exportIntervalMillis: config.metricExportIntervalMs,
		}),
		logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
		instrumentations,
	});
}
