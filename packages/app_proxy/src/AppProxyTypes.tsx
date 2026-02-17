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

import type {CSPOptions} from '@fluxer/app_proxy/src/app_server/utils/CSP';
import type {SentryConfig, TelemetryConfig} from '@fluxer/config/src/MasterZodSchema';
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import type {Logger} from '@fluxer/logger/src/Logger';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {MiddlewareHandler} from 'hono';

export interface AppProxySentryProxyConfig {
	project_id: string;
	public_key: string;
	target_url: string;
	path_prefix: string;
}

export interface AppProxyConfig {
	env: string;
	port: number;
	static_cdn_endpoint: string;
	sentry_proxy_path: string;
	sentry_report_host: string;
	sentry_proxy: AppProxySentryProxyConfig | null;
	assets_dir: string;
	kv: {
		url: string;
		timeout_ms: number;
	};
	rate_limit: {
		sentry: {
			limit: number;
			window_ms: number;
		};
	};
	telemetry: TelemetryConfig;
	sentry: SentryConfig;
}

export interface AppProxyContext {
	config: AppProxyConfig;
	logger: Logger;
	rateLimitService: IRateLimitService | null;
}

export interface AppProxyHonoEnv {
	Variables: AppProxyContext;
}

export type AppProxyMiddleware = MiddlewareHandler<AppProxyHonoEnv>;

export interface CreateAppProxyAppOptions {
	config: AppProxyConfig;
	logger: Logger;
	rateLimitService?: IRateLimitService | null;
	metricsCollector?: MetricsCollector;
	tracing?: TracingOptions;
	customMiddleware?: Array<AppProxyMiddleware>;
	sentryProxyPath?: string;
	assetsPath?: string;
	staticCDNEndpoint?: string;
	staticDir?: string;
	cspDirectives?: CSPOptions;
	sentryProxyEnabled?: boolean;
	sentryProxyRouteEnabled?: boolean;
}
