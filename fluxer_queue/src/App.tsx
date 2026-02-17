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

import {Config} from '@app/Config';
import {shutdownInstrumentation} from '@app/Instrument';
import {Logger} from '@app/Logger';
import {createServiceTelemetry} from '@fluxer/hono/src/middleware/TelemetryAdapters';
import {createServer, setupGracefulShutdown} from '@fluxer/hono/src/Server';
import {createQueueApp} from '@fluxer/queue/src/App';
import {createRateLimitService, type RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import {captureException} from '@fluxer/sentry/src/Sentry';
import '@app/Instrument';

async function main() {
	Logger.info('Starting fluxer_queue');

	const telemetry = createServiceTelemetry({
		serviceName: 'fluxer-queue',
		skipPaths: ['/_health'],
	});

	function createLogger(name: string) {
		return Logger.child({module: name});
	}

	let rateLimitService: RateLimitService | null = null;
	rateLimitService = createRateLimitService(null);

	const {app, engine, cronScheduler, start, shutdown} = createQueueApp({
		config: {
			dataDir: Config.dataDir,
			snapshotEveryMs: Config.snapshotEveryMs,
			snapshotAfterOps: Config.snapshotAfterOps,
			snapshotZstdLevel: Config.snapshotZstdLevel,
			defaultVisibilityTimeoutMs: Config.defaultVisibilityTimeoutMs,
			visibilityTimeoutBackoffMs: Config.visibilityTimeoutBackoffMs,
			maxReceiveBatch: Config.maxReceiveBatch,
			commandBuffer: Config.commandBuffer,
		},
		loggerFactory: createLogger,
		metricsCollector: telemetry.metricsCollector,
		tracing: telemetry.tracing,
		rateLimitService,
		rateLimitConfig:
			Config.rateLimit?.limit != null && Config.rateLimit.window_ms != null
				? {
						enabled: true,
						maxAttempts: Config.rateLimit.limit,
						windowMs: Config.rateLimit.window_ms,
						skipPaths: ['/_health'],
					}
				: null,
		internalSecret: Config.secret,
	});

	await start();

	app.use('*', async (_ctx, next) => {
		const stats = engine.getStats();
		const cronStats = cronScheduler.getStats();

		telemetry.metricsCollector.recordGauge({name: 'fluxer_queue_jobs_ready', value: stats.ready});
		telemetry.metricsCollector.recordGauge({name: 'fluxer_queue_jobs_processing', value: stats.processing});
		telemetry.metricsCollector.recordGauge({name: 'fluxer_queue_jobs_scheduled', value: stats.scheduled});
		telemetry.metricsCollector.recordGauge({name: 'fluxer_queue_jobs_dead_letter', value: stats.deadLetter});
		telemetry.metricsCollector.recordGauge({name: 'fluxer_queue_cron_schedules_total', value: cronStats.total});
		telemetry.metricsCollector.recordGauge({name: 'fluxer_queue_cron_schedules_enabled', value: cronStats.enabled});

		await next();
	});

	const server = createServer(app, {port: Config.port});

	setupGracefulShutdown(
		async () => {
			await shutdown();
			await shutdownInstrumentation();
			await new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
		},
		{logger: Logger},
	);

	Logger.info({port: Config.port}, 'Server started');

	await new Promise(() => {});
}

main().catch((err) => {
	Logger.error({err}, 'Fatal error');
	captureException(err instanceof Error ? err : new Error(String(err)), {fatal: true});
	process.exit(1);
});
