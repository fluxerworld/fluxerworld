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

export interface OtlpConfig {
	endpoints: {
		traces: string;
		metrics: string;
		logs: string;
	};
	headers?: Record<string, string>;
}

export interface CounterMetric {
	name: string;
	value?: number;
	dimensions?: Record<string, string>;
}

export interface HistogramMetric {
	name: string;
	valueMs: number;
	dimensions?: Record<string, string>;
}

export interface GaugeMetric {
	name: string;
	value: number;
	dimensions?: Record<string, string>;
}

export interface TelemetryService {
	isTelemetryActive(): boolean;
	isTelemetryEnabled(): boolean;
	shouldInitializeTelemetry(): boolean;
	recordCounter(metric: CounterMetric): void;
	recordHistogram(metric: HistogramMetric): void;
	recordGauge(metric: GaugeMetric): void;
	getOtlpConfig(): OtlpConfig | null;
	initializeTelemetry(options: {serviceName: string; serviceVersion?: string; environment?: string}): void;
	shutdownTelemetry(): Promise<void>;
}

let _telemetryService: TelemetryService | null = null;

export function initializeTelemetryService(service: TelemetryService): void {
	if (_telemetryService !== null) {
		throw new Error('Telemetry service has already been initialized');
	}
	_telemetryService = service;
}

export function resetTelemetryService(): void {
	_telemetryService = null;
}

const noopTelemetryService: TelemetryService = {
	isTelemetryActive: () => false,
	isTelemetryEnabled: () => false,
	shouldInitializeTelemetry: () => false,
	recordCounter: () => {},
	recordHistogram: () => {},
	recordGauge: () => {},
	getOtlpConfig: () => null,
	initializeTelemetry: () => {},
	shutdownTelemetry: async () => {},
};

function getTelemetryService(): TelemetryService {
	return _telemetryService ?? noopTelemetryService;
}

export function isTelemetryActive(): boolean {
	return getTelemetryService().isTelemetryActive();
}

export function isTelemetryEnabled(): boolean {
	return getTelemetryService().isTelemetryEnabled();
}

export function shouldInitializeTelemetry(): boolean {
	return getTelemetryService().shouldInitializeTelemetry();
}

export function recordCounter(metric: CounterMetric): void {
	getTelemetryService().recordCounter(metric);
}

export function recordHistogram(metric: HistogramMetric): void {
	getTelemetryService().recordHistogram(metric);
}

export function recordGauge(metric: GaugeMetric): void {
	getTelemetryService().recordGauge(metric);
}

export function getOtlpConfig(): OtlpConfig | null {
	return getTelemetryService().getOtlpConfig();
}

export function initializeTelemetry(options: {
	serviceName: string;
	serviceVersion?: string;
	environment?: string;
}): void {
	getTelemetryService().initializeTelemetry(options);
}

export async function shutdownTelemetry(): Promise<void> {
	return getTelemetryService().shutdownTelemetry();
}
