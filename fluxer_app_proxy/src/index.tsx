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
import {createAppProxyApp} from '@fluxer/app_proxy/src/App';
import {buildFluxerCSPOptions} from '@fluxer/app_proxy/src/app_server/utils/CSP';
import {KVCacheProvider} from '@fluxer/cache/src/providers/KVCacheProvider';
import {createServiceTelemetry} from '@fluxer/hono/src/middleware/TelemetryAdapters';
import {createServer, setupGracefulShutdown} from '@fluxer/hono/src/Server';
import {KVClient} from '@fluxer/kv_client/src/KVClient';
import {throwKVRequiredError} from '@fluxer/rate_limit/src/KVRequiredError';
import {RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';

const telemetry = createServiceTelemetry({
	serviceName: 'fluxer-app-proxy',
	skipPaths: ['/_health'],
});

let rateLimitService: RateLimitService | null = null;

async function main(): Promise<void> {
	if (Config.kv.url) {
		const kvClient = new KVClient({url: Config.kv.url, timeoutMs: Config.kv.timeout_ms});
		const cacheService = new KVCacheProvider({client: kvClient});
		rateLimitService = new RateLimitService(cacheService);
		Logger.info({kvUrl: Config.kv.url}, 'KV-backed rate limiting enabled');
	} else {
		throwKVRequiredError({
			serviceName: 'fluxer_app_proxy',
			configPath: 'Config.kv.url',
		});
	}

	const cspDirectives = buildFluxerCSPOptions({
		sentryProxy: Config.sentry_proxy
			? {
					projectId: Config.sentry_proxy.project_id,
					publicKey: Config.sentry_proxy.public_key,
					targetUrl: Config.sentry_proxy.target_url,
					pathPrefix: Config.sentry_proxy.path_prefix,
				}
			: null,
		sentryProxyPath: Config.sentry_proxy_path,
		sentryReportHost: Config.sentry_report_host,
	});

	const {app, shutdown} = await createAppProxyApp({
		config: Config,
		cspDirectives,
		logger: Logger,
		rateLimitService,
		metricsCollector: telemetry.metricsCollector,
		sentryProxyPath: Config.sentry_proxy_path,
		staticCDNEndpoint: Config.static_cdn_endpoint,
		staticDir: Config.assets_dir,
		tracing: telemetry.tracing,
	});

	const port = Config.port;
	Logger.info({port}, 'Starting Fluxer App Proxy');

	const server = createServer(app, {port});

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
}

main().catch((err) => {
	Logger.fatal({error: err}, 'fatal error');
	process.exit(1);
});
