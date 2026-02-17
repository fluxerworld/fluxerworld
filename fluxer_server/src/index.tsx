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

import type {Server} from 'node:http';
import {Config, type Config as FluxerServerConfig} from '@app/Config';
import {shutdownInstrumentation} from '@app/Instrument';
import {createComponentLogger, Logger} from '@app/Logger';
import {mountRoutes} from '@app/Routes';
import {createGatewayProcessManager, type GatewayProcessManager} from '@app/utils/GatewayProcessManager';
import {createGatewayProxy} from '@app/utils/GatewayProxy';
import {getSnowflakeService} from '@fluxer/api/src/middleware/ServiceRegistry';
import {initializeWorkerDependencies} from '@fluxer/api/src/worker/WorkerDependencies';
import {workerTasks} from '@fluxer/api/src/worker/WorkerTaskRegistry';
import {createServerWithUpgrade} from '@fluxer/hono/src/Server';
import type {BaseHonoEnv} from '@fluxer/hono_types/src/HonoTypes';
import {DirectQueueProvider} from '@fluxer/worker/src/providers/DirectQueueProvider';
import {createWorker, type WorkerResult} from '@fluxer/worker/src/runtime/WorkerFactory';
import type {Hono} from 'hono';

export interface FluxerServerOptions {
	config?: FluxerServerConfig;
	staticDir?: string;
}

export interface FluxerServerResult {
	app: Hono<BaseHonoEnv>;
	initialize: () => Promise<void>;
	start: () => Promise<void>;
	shutdown: () => Promise<void>;
}

export async function createFluxerServer(options: FluxerServerOptions = {}): Promise<FluxerServerResult> {
	const config = options.config ?? Config;
	const staticDir = options.staticDir;

	const mounted = await mountRoutes({
		config,
		staticDir,
	});

	let server: Server | null = null;
	let worker: WorkerResult | null = null;
	let gatewayManager: GatewayProcessManager | null = null;
	let isShuttingDown = false;

	const start = async (): Promise<void> => {
		Logger.info(
			{
				host: config.host,
				port: config.port,
				env: config.env,
				database: config.database.backend,
				workerEnabled: config.services.queue !== undefined,
			},
			'Starting Fluxer Server',
		);

		Logger.info('Starting background services (queue engine, cron scheduler)');
		await mounted.start();

		const shouldStartGatewayProcess =
			config.services.gateway && (config.env === 'production' || config.dev.test_mode_enabled);
		if (shouldStartGatewayProcess) {
			Logger.info('Initializing Gateway Process Manager');
			gatewayManager = createGatewayProcessManager();
			await gatewayManager.start();
		}

		if (config.services.queue !== undefined) {
			const workerLogger = createComponentLogger('worker');

			let queueProvider: DirectQueueProvider | undefined;
			if (mounted.services.queue) {
				workerLogger.info('Creating DirectQueueProvider for in-process communication');
				queueProvider = new DirectQueueProvider({
					engine: mounted.services.queue.engine,
					cronScheduler: mounted.services.queue.cronScheduler,
				});
			}

			workerLogger.info('Initializing worker dependencies');
			const snowflakeService = getSnowflakeService();
			await snowflakeService.initialize();
			const workerDependencies = await initializeWorkerDependencies(snowflakeService);

			worker = createWorker({
				queue: {
					queueBaseUrl: config.internal.queue,
					queueProvider,
				},
				runtime: {
					concurrency: config.services.queue.concurrency ?? 1,
				},
				logger: workerLogger,
				dependencies: workerDependencies,
			});

			workerLogger.info({taskCount: Object.keys(workerTasks).length}, 'Registering worker tasks');
			worker.registerTasks(workerTasks);

			workerLogger.info({concurrency: config.services.queue.concurrency ?? 1}, 'Starting embedded worker');
			await worker.start();
		}

		const gatewayProxy = createGatewayProxy();

		const onUpgrade = gatewayProxy.onUpgrade;

		return await new Promise((resolve) => {
			server = createServerWithUpgrade(mounted.app, {
				hostname: config.host,
				port: config.port,
				onUpgrade,
				onListen: (info) => {
					Logger.info(
						{
							address: info.address,
							port: info.port,
						},
						'Fluxer Server listening',
					);
					resolve();
				},
			});
		});
	};

	const shutdown = async (): Promise<void> => {
		if (isShuttingDown) {
			Logger.warn('Shutdown already in progress, ignoring duplicate signal');
			return;
		}
		isShuttingDown = true;

		Logger.info('Beginning graceful shutdown of Fluxer Server');

		const shutdownSteps = [
			{
				name: 'Worker',
				fn: async () => {
					if (worker !== null) {
						Logger.info('Stopping embedded worker');
						await worker.shutdown();
					}
				},
			},
			{
				name: 'HTTP Server',
				fn: async () => {
					if (server !== null) {
						Logger.info('Stopping HTTP server');
						server.closeAllConnections();
						await new Promise<void>((resolve) => {
							const timeout = setTimeout(() => {
								Logger.warn('HTTP server close timeout, forcing shutdown');
								resolve();
							}, 3000);
							server!.close((err) => {
								clearTimeout(timeout);
								if (err !== undefined) {
									Logger.error({error: err.message}, 'Error closing HTTP server');
								} else {
									Logger.info('HTTP server closed');
								}
								resolve();
							});
						});
					}
				},
			},
			{
				name: 'Application Services',
				fn: async () => {
					Logger.info('Shutting down application services');
					await mounted.shutdown();
				},
			},
			{
				name: 'Gateway Process',
				fn: async () => {
					if (gatewayManager) {
						Logger.info('Stopping Gateway process');
						await gatewayManager.stop();
					}
				},
			},
			{
				name: 'Instrumentation',
				fn: async () => {
					Logger.info('Shutting down telemetry and instrumentation');
					await shutdownInstrumentation();
				},
			},
		];

		for (const step of shutdownSteps) {
			try {
				await step.fn();
			} catch (error) {
				Logger.error(
					{
						step: step.name,
						error: error instanceof Error ? error.message : 'Unknown error',
					},
					'Error during shutdown step',
				);
			}
		}

		Logger.info('Fluxer Server shutdown complete');
	};

	const initialize = async (): Promise<void> => {
		Logger.info('Initializing services');
		await mounted.initialize();
	};

	return {
		app: mounted.app,
		initialize,
		start,
		shutdown,
	};
}
