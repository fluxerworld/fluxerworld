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

import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import type {S3RateLimitConfig} from '@fluxer/s3/src/app/S3AppConfigTypes';
import {setupS3ErrorHandling} from '@fluxer/s3/src/app/S3ErrorHandling';
import {setupS3Middleware} from '@fluxer/s3/src/app/S3MiddlewareSetup';
import {resolveS3RateLimitService} from '@fluxer/s3/src/app/S3RateLimitResolver';
import {setupS3ResponseHeadersMiddleware} from '@fluxer/s3/src/app/S3ResponseHeadersMiddleware';
import {registerS3Routes} from '@fluxer/s3/src/app/S3RouteRegistrar';
import type {S3AuthConfig} from '@fluxer/s3/src/middleware/S3AuthMiddleware';
import type {S3ServiceConfig} from '@fluxer/s3/src/s3/S3Service';
import {S3Service} from '@fluxer/s3/src/s3/S3Service';
import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import {Hono} from 'hono';

export interface CreateS3AppOptions {
	logger: LoggerInterface;
	s3Config: S3ServiceConfig;
	authConfig: S3AuthConfig;
	metricsCollector?: MetricsCollector;
	tracing?: TracingOptions;
	kvUrl?: string;
	rateLimitService?: RateLimitService | null;
	rateLimitConfig?: S3RateLimitConfig | null;
}

export interface S3AppResult {
	app: Hono<HonoEnv>;
	getS3Service: () => S3Service;
	initialize: () => Promise<void>;
	shutdown: () => void;
}

export function createS3App(options: CreateS3AppOptions): S3AppResult {
	const {logger, s3Config, authConfig, metricsCollector, tracing, kvUrl, rateLimitService, rateLimitConfig} = options;
	const s3Service = new S3Service(s3Config, logger);
	const resolvedRateLimitService = resolveS3RateLimitService({
		kvUrl,
		rateLimitService,
		rateLimitConfig,
	});

	const initialize = async (): Promise<void> => {
		await s3Service.initialize();
	};

	const shutdown = (): void => {};
	const app = new Hono<HonoEnv>();

	setupS3Middleware({
		app,
		logger,
		s3Service,
		authConfig,
		metricsCollector,
		tracing,
		rateLimitService: resolvedRateLimitService,
		rateLimitConfig,
	});
	setupS3ResponseHeadersMiddleware(app);
	registerS3Routes(app);
	setupS3ErrorHandling({app, logger});

	return {
		app,
		getS3Service: () => s3Service,
		initialize,
		shutdown,
	};
}
