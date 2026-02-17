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

import {getDefaultTelemetryConfig} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryConfig';
import {
	createDefaultTelemetryLogger,
	type ITelemetryInitLogger,
} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryLogger';
import {
	createTelemetryRuntimeManager,
	type ITelemetryRuntimeManager,
} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryManager';

export interface InstrumentationConfig {
	cassandra?: boolean;
	aws?: boolean;
	fetch?: boolean;
}

export interface TelemetryConfig {
	enabled: boolean;
	serviceName: string;
	serviceVersion: string;
	serviceInstanceId: string;
	environment: string;
	traceSamplingRatio: number;
	otlpEndpoint: string;
	otlpApiKey?: string;
	exportTimeout: number;
	metricExportIntervalMs: number;
	ignoreIncomingPaths: Array<string>;
	instrumentations?: InstrumentationConfig;
}

export interface OtlpConfig {
	endpoints: {
		traces: string;
		metrics: string;
		logs: string;
	};
	headers?: Record<string, string>;
}

export interface TelemetryInitLogger {
	info(msg: string): void;
	info(obj: Record<string, unknown>, msg: string): void;
}

export interface ITelemetryManager {
	initialize(config?: Partial<TelemetryConfig>): Promise<void>;
	shutdown(): Promise<void>;
	isActive(): boolean;
	shouldInitialize(): boolean;
	getConfig(): TelemetryConfig | null;
	getOtlpConfig(): OtlpConfig | null;
}

export interface TelemetryManagerOptions {
	logger?: TelemetryInitLogger;
	shouldInitialize?: () => boolean;
}

function createRuntimeManager(options?: TelemetryManagerOptions): ITelemetryRuntimeManager {
	const logger: ITelemetryInitLogger = options?.logger ?? createDefaultTelemetryLogger();
	return createTelemetryRuntimeManager({
		logger,
		shouldInitialize: options?.shouldInitialize ?? (() => true),
	});
}

function createManagerFacade(runtimeManager: ITelemetryRuntimeManager): ITelemetryManager {
	return {
		initialize(config?: Partial<TelemetryConfig>): Promise<void> {
			return runtimeManager.initialize(config);
		},
		shutdown(): Promise<void> {
			return runtimeManager.shutdown();
		},
		isActive(): boolean {
			return runtimeManager.isActive();
		},
		shouldInitialize(): boolean {
			return runtimeManager.shouldInitialize();
		},
		getConfig(): TelemetryConfig | null {
			return runtimeManager.getConfig();
		},
		getOtlpConfig(): OtlpConfig | null {
			return runtimeManager.getOtlpConfig();
		},
	};
}

export function createTelemetryManager(options?: TelemetryManagerOptions): ITelemetryManager {
	return createManagerFacade(createRuntimeManager(options));
}

const defaultTelemetryManager = createTelemetryManager();

export function isTelemetryActive(): boolean {
	return defaultTelemetryManager.isActive();
}

export function getDefaultConfig(): TelemetryConfig {
	return getDefaultTelemetryConfig();
}

export function shouldInitializeTelemetry(): boolean {
	return defaultTelemetryManager.shouldInitialize();
}

export async function initializeTelemetry(config?: Partial<TelemetryConfig>): Promise<void> {
	await defaultTelemetryManager.initialize(config);
}

export async function shutdownTelemetry(): Promise<void> {
	await defaultTelemetryManager.shutdown();
}

export function getTelemetryConfig(): TelemetryConfig | null {
	return defaultTelemetryManager.getConfig();
}

export function getOtlpConfig(): OtlpConfig | null {
	return defaultTelemetryManager.getOtlpConfig();
}
