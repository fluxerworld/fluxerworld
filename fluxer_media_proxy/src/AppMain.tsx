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
import {createMetrics} from '@app/Metrics';
import {createTracing} from '@app/Tracing';
import {createServiceTelemetry} from '@fluxer/hono/src/middleware/TelemetryAdapters';
import {createServer, setupGracefulShutdown} from '@fluxer/hono/src/Server';
import {createMediaProxyApp} from '@fluxer/media_proxy/src/App';
import type {MetricsInterface} from '@fluxer/media_proxy/src/types/Metrics';
import type {TracingInterface} from '@fluxer/media_proxy/src/types/Tracing';
import {createRateLimitService, type RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import {isTelemetryActive} from '@fluxer/telemetry/src/Telemetry';

const metrics: MetricsInterface = createMetrics();

const tracing: TracingInterface = createTracing();

let rateLimitService: RateLimitService | null = null;
rateLimitService = createRateLimitService(null);

const requestTelemetry = createServiceTelemetry({
	serviceName: 'fluxer-media-proxy',
	skipPaths: ['/_health', '/internal/telemetry'],
});

const {app, shutdown} = await createMediaProxyApp({
	config: {
		nodeEnv: Config.env,
		secretKey: Config.mediaProxy.secretKey,
		requireCloudflareEdge: Config.mediaProxy.requireCloudflareEdge,
		staticMode: Config.mediaProxy.staticMode,
		s3: {
			endpoint: Config.aws.s3Endpoint,
			region: Config.aws.s3Region,
			accessKeyId: Config.aws.accessKeyId,
			secretAccessKey: Config.aws.secretAccessKey,
			bucketCdn: Config.aws.s3BucketCdn,
			bucketUploads: Config.aws.s3BucketUploads,
			bucketStatic: Config.aws.s3BucketStatic,
		},
	},
	logger: Logger,
	metrics,
	tracing,
	requestMetricsCollector: requestTelemetry.metricsCollector,
	requestTracing: requestTelemetry.tracing,
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
	onTelemetryRequest: async () => ({
		telemetry_enabled: isTelemetryActive(),
		service: 'fluxer_media_proxy',
		timestamp: new Date().toISOString(),
	}),
});

const server = createServer(app, {port: Config.server.port});

Logger.info({port: Config.server.port}, `Starting Fluxer Media Proxy on port ${Config.server.port}`);

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
