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

import {getMetricsService, initializeMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {Logger} from '@fluxer/api/src/Logger';
import {getKVClient} from '@fluxer/api/src/middleware/ServiceRegistry';
import {initializeSearch} from '@fluxer/api/src/SearchFactory';
import {HttpWorkerQueue} from '@fluxer/api/src/worker/HttpWorkerQueue';
import {setWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {initializeWorkerDependencies, shutdownWorkerDependencies} from '@fluxer/api/src/worker/WorkerDependencies';
import {WorkerMetricsCollector} from '@fluxer/api/src/worker/WorkerMetricsCollector';
import {WorkerRunner} from '@fluxer/api/src/worker/WorkerRunner';
import {workerTasks} from '@fluxer/api/src/worker/WorkerTaskRegistry';
import {setupGracefulShutdown} from '@fluxer/hono/src/Server';
import {captureException, flushSentry as flush} from '@fluxer/sentry/src/Sentry';
import {ms} from 'itty-time';

const WORKER_CONCURRENCY = 20;

async function registerCronJobs(queue: HttpWorkerQueue): Promise<void> {
	try {
		await queue.upsertCron('processAssetDeletionQueue', 'processAssetDeletionQueue', {}, '0 */5 * * * *');
		await queue.upsertCron('processCloudflarePurgeQueue', 'processCloudflarePurgeQueue', {}, '0 */2 * * * *');
		await queue.upsertCron(
			'processPendingBulkMessageDeletions',
			'processPendingBulkMessageDeletions',
			{},
			'0 */10 * * * *',
		);
		await queue.upsertCron('processInactivityDeletions', 'processInactivityDeletions', {}, '0 0 */6 * * *');
		await queue.upsertCron('expireAttachments', 'expireAttachments', {}, '0 0 */12 * * *');
		await queue.upsertCron('cleanupCsamEvidence', 'cleanupCsamEvidence', {}, '0 0 3 * * *');
		await queue.upsertCron('csamScanConsumer', 'csamScanConsumer', {}, '* * * * * *');
		await queue.upsertCron('syncDiscoveryIndex', 'syncDiscoveryIndex', {}, '0 */15 * * * *');

		Logger.info('Cron jobs registered successfully');
	} catch (error) {
		Logger.error({error}, 'Failed to register cron jobs');
	}
}

export async function startWorkerMain(): Promise<void> {
	Logger.info('Starting worker backend...');

	initializeMetricsService();
	Logger.info('MetricsService initialized');

	const kvClient = getKVClient();
	const snowflakeService = new SnowflakeService(kvClient);
	await snowflakeService.initialize();
	Logger.info('Shared SnowflakeService initialized');

	const dependencies = await initializeWorkerDependencies(snowflakeService);
	setWorkerDependencies(dependencies);

	const queue = new HttpWorkerQueue();
	await registerCronJobs(queue);

	const metricsCollector = new WorkerMetricsCollector({
		kvClient: dependencies.kvClient,
		metricsService: getMetricsService(),
		assetDeletionQueue: dependencies.assetDeletionQueue,
		purgeQueue: dependencies.purgeQueue,
		bulkMessageDeletionQueue: dependencies.bulkMessageDeletionQueueService,
		accountDeletionQueue: dependencies.deletionQueueService,
	});

	const runner = new WorkerRunner({
		tasks: workerTasks,
		concurrency: WORKER_CONCURRENCY,
	});

	try {
		try {
			await initializeSearch();
			Logger.info('Search initialised for worker backend');
		} catch (error) {
			Logger.warn({err: error}, 'Search initialisation failed; continuing without search');
		}

		metricsCollector.start();
		Logger.info('WorkerMetricsCollector started');

		await runner.start();
		Logger.info(`Worker runner started with ${WORKER_CONCURRENCY} workers`);

		const shutdown = async (): Promise<void> => {
			Logger.info('Shutting down worker backend...');
			metricsCollector.stop();
			await runner.stop();
			await shutdownWorkerDependencies(dependencies);
			await snowflakeService.shutdown();
		};

		setupGracefulShutdown(shutdown, {logger: Logger, timeoutMs: 30000});

		process.on('uncaughtException', async (error) => {
			Logger.error({err: error}, 'Uncaught Exception');
			captureException(error);
			await flush(ms('2 seconds'));
			await shutdown();
			process.exit(0);
		});

		process.on('unhandledRejection', async (reason: unknown) => {
			Logger.error({err: reason}, 'Unhandled Rejection at Promise');
			captureException(reason instanceof Error ? reason : new Error(String(reason)));
			await flush(ms('2 seconds'));
			setTimeout(() => process.exit(1), ms('5 seconds')).unref();
			await shutdown();
		});
	} catch (error: unknown) {
		Logger.error({err: error}, 'Failed to start worker backend');
		captureException(error instanceof Error ? error : new Error(String(error)));
		await flush(ms('2 seconds'));
		process.exit(1);
	}
}
