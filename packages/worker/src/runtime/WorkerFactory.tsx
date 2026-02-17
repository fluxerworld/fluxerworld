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

import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {setWorkerDependencies} from '@fluxer/worker/src/context/WorkerContext';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import type {
	LeasedQueueJob,
	TracingInterface,
	WorkerConfig,
	WorkerQueueConfig,
	WorkerRuntimeConfig,
} from '@fluxer/worker/src/contracts/WorkerTypes';
import type {IQueueProvider} from '@fluxer/worker/src/providers/IQueueProvider';
import {WorkerRunner} from '@fluxer/worker/src/runtime/WorkerRunner';
import {WorkerTaskRegistry} from '@fluxer/worker/src/runtime/WorkerTaskRegistry';
import {WorkerService} from '@fluxer/worker/src/services/WorkerService';

export interface CreateWorkerOptions {
	queue: WorkerQueueOptions;
	runtime?: WorkerRuntimeConfig | undefined;
	logger: LoggerInterface;
	dependencies?: unknown;
	taskRegistry?: WorkerTaskRegistry | undefined;
	tracing?: TracingInterface | undefined;
}

export interface CreateWorkerLegacyOptions {
	config: WorkerConfig;
	queueProvider?: IQueueProvider | undefined;
	logger: LoggerInterface;
	dependencies?: unknown;
	taskRegistry?: WorkerTaskRegistry | undefined;
	tracing?: TracingInterface | undefined;
}

export interface WorkerQueueOptions {
	queueProvider?: IQueueProvider | undefined;
	queueBaseUrl?: string | undefined;
	requestTimeoutMs?: number | undefined;
}

interface ResolvedWorkerFactoryOptions {
	queue: WorkerQueueOptions;
	runtime: WorkerRuntimeConfig;
	logger: LoggerInterface;
	dependencies?: unknown;
	taskRegistry?: WorkerTaskRegistry | undefined;
	tracing?: TracingInterface | undefined;
}

export interface WorkerResult {
	start: () => Promise<void>;
	shutdown: () => Promise<void>;
	processTask: (job: LeasedQueueJob) => Promise<void>;
	getRunner: () => WorkerRunner;
	getWorkerService: () => IWorkerService;
	registerTask: <TPayload = Record<string, unknown>>(name: string, handler: WorkerTaskHandler<TPayload>) => void;
	registerTasks: (tasks: Record<string, WorkerTaskHandler>) => void;
}

type WorkerFactoryOptions = CreateWorkerOptions | CreateWorkerLegacyOptions;

function isLegacyCreateWorkerOptions(options: WorkerFactoryOptions): options is CreateWorkerLegacyOptions {
	return 'config' in options;
}

function resolveLegacyQueueOptions(config: WorkerQueueConfig, queueProvider?: IQueueProvider): WorkerQueueOptions {
	return {
		queueProvider,
		queueBaseUrl: config.queueBaseUrl,
		requestTimeoutMs: config.requestTimeoutMs,
	};
}

function resolveWorkerFactoryOptions(options: WorkerFactoryOptions): ResolvedWorkerFactoryOptions {
	if (isLegacyCreateWorkerOptions(options)) {
		return {
			queue: resolveLegacyQueueOptions(options.config, options.queueProvider),
			runtime: {
				workerId: options.config.workerId,
				taskTypes: options.config.taskTypes,
				concurrency: options.config.concurrency,
			},
			logger: options.logger,
			dependencies: options.dependencies,
			taskRegistry: options.taskRegistry,
			tracing: options.tracing,
		};
	}

	return {
		queue: options.queue,
		runtime: options.runtime ?? {},
		logger: options.logger,
		dependencies: options.dependencies,
		taskRegistry: options.taskRegistry,
		tracing: options.tracing,
	};
}

function assertTaskRegistryMutable(runner: WorkerRunner | null): void {
	if (runner?.isRunning()) {
		throw new Error('Cannot register tasks after worker start. Register tasks before starting the worker.');
	}
}

export function createWorker(options: WorkerFactoryOptions): WorkerResult {
	const resolvedOptions = resolveWorkerFactoryOptions(options);
	const {queue, runtime, logger, dependencies, taskRegistry: providedRegistry, tracing} = resolvedOptions;

	if (dependencies !== undefined) {
		setWorkerDependencies(dependencies);
	}

	const taskRegistry = providedRegistry ?? new WorkerTaskRegistry();

	let runner: WorkerRunner | null = null;
	let workerService: WorkerService | null = null;

	function ensureRunner(): WorkerRunner {
		if (!runner) {
			runner = new WorkerRunner({
				tasks: taskRegistry.getTasks(),
				queueBaseUrl: queue.queueBaseUrl,
				queueProvider: queue.queueProvider,
				logger,
				workerId: runtime.workerId,
				taskTypes: runtime.taskTypes,
				concurrency: runtime.concurrency,
				tracing,
				requestTimeoutMs: queue.requestTimeoutMs,
			});
		}
		return runner;
	}

	function ensureWorkerService(): WorkerService {
		if (!workerService) {
			workerService = new WorkerService({
				queueBaseUrl: queue.queueBaseUrl,
				queueProvider: queue.queueProvider,
				logger,
				tracing,
				timeoutMs: queue.requestTimeoutMs,
			});
		}
		return workerService;
	}

	return {
		async start() {
			const r = ensureRunner();
			await r.start();
		},

		async shutdown() {
			if (runner) {
				await runner.stop();
			}
		},

		async processTask(job: LeasedQueueJob) {
			const r = ensureRunner();
			await r.processJob(job);
		},

		getRunner() {
			return ensureRunner();
		},

		getWorkerService() {
			return ensureWorkerService();
		},

		registerTask<TPayload = Record<string, unknown>>(name: string, handler: WorkerTaskHandler<TPayload>) {
			assertTaskRegistryMutable(runner);
			taskRegistry.register(name, handler);
			runner = null;
		},

		registerTasks(tasks: Record<string, WorkerTaskHandler>) {
			assertTaskRegistryMutable(runner);
			taskRegistry.registerAll(tasks);
			runner = null;
		},
	};
}
