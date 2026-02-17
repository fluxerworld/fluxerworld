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

import type {OtlpConfig, TelemetryConfig} from '@fluxer/telemetry/src/Telemetry';
import {
	cloneTelemetryConfig,
	createOtlpConfigFromTelemetryConfig,
	getDefaultTelemetryConfig,
	resolveTelemetryConfig,
} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryConfig';
import type {ITelemetryInitLogger} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryLogger';
import {createTelemetrySdk} from '@fluxer/telemetry/src/telemetry_runtime/TelemetrySdk';
import type {NodeSDK} from '@opentelemetry/sdk-node';

export interface ITelemetryRuntimeManager {
	initialize(config?: Partial<TelemetryConfig>): Promise<void>;
	shutdown(): Promise<void>;
	isActive(): boolean;
	shouldInitialize(): boolean;
	getConfig(): TelemetryConfig | null;
	getOtlpConfig(): OtlpConfig | null;
}

export interface TelemetryRuntimeManagerOptions {
	logger: ITelemetryInitLogger;
	shouldInitialize: () => boolean;
}

function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

class TelemetryRuntimeManager implements ITelemetryRuntimeManager {
	private sdk: NodeSDK | null = null;
	private config: TelemetryConfig | null = null;
	private initializationTask: Promise<void> | null = null;
	private shutdownTask: Promise<void> | null = null;
	private readonly logger: ITelemetryInitLogger;
	private readonly shouldInitializePredicate: () => boolean;

	public constructor(options: TelemetryRuntimeManagerOptions) {
		this.logger = options.logger;
		this.shouldInitializePredicate = options.shouldInitialize;
	}

	public isActive(): boolean {
		return this.sdk !== null;
	}

	public shouldInitialize(): boolean {
		return this.shouldInitializePredicate();
	}

	public getConfig(): TelemetryConfig | null {
		if (this.config === null) {
			return null;
		}
		return cloneTelemetryConfig(this.config);
	}

	public getOtlpConfig(): OtlpConfig | null {
		if (!this.shouldInitialize()) {
			return null;
		}
		const config = this.config ?? getDefaultTelemetryConfig();
		return createOtlpConfigFromTelemetryConfig(config);
	}

	public async initialize(config?: Partial<TelemetryConfig>): Promise<void> {
		if (this.shutdownTask !== null) {
			await this.shutdownTask;
		}
		if (this.sdk !== null) {
			this.logger.info('Telemetry already initialized');
			return;
		}
		if (this.initializationTask !== null) {
			await this.initializationTask;
			return;
		}
		if (!this.shouldInitialize()) {
			this.logger.info('Telemetry disabled');
			return;
		}

		const resolvedConfig = resolveTelemetryConfig(config);
		if (!resolvedConfig.enabled) {
			this.config = resolvedConfig;
			this.logger.info('Telemetry disabled by configuration');
			return;
		}

		const initializationTask = this.initializeInternal(resolvedConfig);
		this.initializationTask = initializationTask;
		try {
			await initializationTask;
		} finally {
			if (this.initializationTask === initializationTask) {
				this.initializationTask = null;
			}
		}
	}

	public async shutdown(): Promise<void> {
		if (this.initializationTask !== null) {
			await this.initializationTask;
		}
		if (this.shutdownTask !== null) {
			await this.shutdownTask;
			return;
		}

		const shutdownTask = this.shutdownInternal();
		this.shutdownTask = shutdownTask;
		try {
			await shutdownTask;
		} finally {
			if (this.shutdownTask === shutdownTask) {
				this.shutdownTask = null;
			}
		}
	}

	private async initializeInternal(config: TelemetryConfig): Promise<void> {
		this.logger.info(
			{
				serviceName: config.serviceName,
				environment: config.environment,
				endpoint: config.otlpEndpoint,
				traceSamplingRatio: config.traceSamplingRatio,
			},
			'Initializing telemetry',
		);

		const sdk = await createTelemetrySdk(config, this.logger);
		try {
			await Promise.resolve(sdk.start());
		} catch (error) {
			await Promise.resolve(sdk.shutdown()).catch(() => undefined);
			this.logger.info({error: formatError(error)}, 'Telemetry initialization failed');
			throw error;
		}

		this.sdk = sdk;
		this.config = cloneTelemetryConfig(config);
		this.logger.info('Telemetry initialized successfully');
	}

	private async shutdownInternal(): Promise<void> {
		const sdk = this.sdk;
		this.sdk = null;
		this.config = null;
		if (sdk !== null) {
			await sdk.shutdown();
		}
		this.logger.info('Telemetry shutdown complete');
	}
}

export function createTelemetryRuntimeManager(options: TelemetryRuntimeManagerOptions): ITelemetryRuntimeManager {
	return new TelemetryRuntimeManager(options);
}
