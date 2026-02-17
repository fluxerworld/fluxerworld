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

import fs from 'node:fs/promises';
import {createErrorHandler} from '@fluxer/errors/src/ErrorHandler';
import {applyMiddlewareStack} from '@fluxer/hono/src/middleware/MiddlewareStack';
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {createAttachmentsHandler} from '@fluxer/media_proxy/src/controllers/AttachmentsController';
import {createExternalMediaHandler} from '@fluxer/media_proxy/src/controllers/ExternalMediaController';
import {createFrameExtractionHandler} from '@fluxer/media_proxy/src/controllers/FrameExtractionController';
import {
	createGuildMemberImageRouteHandler,
	createImageRouteHandler,
	createSimpleImageRouteHandler,
} from '@fluxer/media_proxy/src/controllers/ImageController';
import {createMetadataHandler} from '@fluxer/media_proxy/src/controllers/MetadataController';
import {createStaticProxyHandler} from '@fluxer/media_proxy/src/controllers/StaticProxyController';
import {createStickerRouteHandler} from '@fluxer/media_proxy/src/controllers/StickerController';
import {createThemeHandler} from '@fluxer/media_proxy/src/controllers/ThemeController';
import {createThumbnailHandler} from '@fluxer/media_proxy/src/controllers/ThumbnailController';
import {CloudflareEdgeIPService} from '@fluxer/media_proxy/src/lib/CloudflareEdgeIPService';
import {createCodecValidator} from '@fluxer/media_proxy/src/lib/CodecValidation';
import {createFFmpegUtils, createFrameExtractor} from '@fluxer/media_proxy/src/lib/FFmpegUtils';
import {createImageProcessor} from '@fluxer/media_proxy/src/lib/ImageProcessing';
import {InMemoryCoalescer} from '@fluxer/media_proxy/src/lib/InMemoryCoalescer';
import {createMediaTransformService} from '@fluxer/media_proxy/src/lib/MediaTransformService';
import {createMediaValidator} from '@fluxer/media_proxy/src/lib/MediaValidation';
import {createMimeTypeUtils} from '@fluxer/media_proxy/src/lib/MimeTypeUtils';
import {NSFWDetectionService} from '@fluxer/media_proxy/src/lib/NSFWDetectionService';
import {createS3Client, createS3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import {createInternalNetworkRequired} from '@fluxer/media_proxy/src/middleware/AuthMiddleware';
import {createCloudflareFirewall} from '@fluxer/media_proxy/src/middleware/CloudflareFirewall';
import {createMetricsMiddleware} from '@fluxer/media_proxy/src/middleware/MetricsMiddleware';
import {createFrameService} from '@fluxer/media_proxy/src/services/FrameService';
import {createMetadataService} from '@fluxer/media_proxy/src/services/MetadataService';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import type {MediaProxyConfig} from '@fluxer/media_proxy/src/types/MediaProxyConfig';
import type {MediaProxyServices} from '@fluxer/media_proxy/src/types/MediaProxyServices';
import type {MetricsInterface} from '@fluxer/media_proxy/src/types/Metrics';
import type {TracingInterface} from '@fluxer/media_proxy/src/types/Tracing';
import {createHttpClient} from '@fluxer/media_proxy/src/utils/FetchUtils';
import type {RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import {captureException} from '@fluxer/sentry/src/Sentry';
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import * as v from 'valibot';

const FLUXER_USER_AGENT = 'Mozilla/5.0 (compatible; Fluxerbot/1.0; +https://fluxer.app)';

export interface CreateMediaProxyAppOptions {
	config: MediaProxyConfig;
	logger: LoggerInterface;
	metrics?: MetricsInterface;
	tracing?: TracingInterface;
	requestMetricsCollector?: MetricsCollector;
	requestTracing?: TracingOptions;
	onTelemetryRequest?: () => Promise<{telemetry_enabled: boolean; service: string; timestamp: string}>;
	rateLimitService?: RateLimitService | null;
	rateLimitConfig?: {
		enabled: boolean;
		maxAttempts: number;
		windowMs: number;
		skipPaths?: Array<string>;
	} | null;
	publicOnly?: boolean;
}

export interface MediaProxyAppResult {
	app: Hono<HonoEnv>;
	shutdown: () => Promise<void>;
	services?: MediaProxyServices;
}

export async function createMediaProxyApp(options: CreateMediaProxyAppOptions): Promise<MediaProxyAppResult> {
	const {
		config,
		logger,
		metrics,
		tracing,
		requestMetricsCollector,
		requestTracing,
		onTelemetryRequest,
		rateLimitService,
		rateLimitConfig,
		publicOnly = false,
	} = options;

	const app = new Hono<HonoEnv>({strict: true});

	applyMiddlewareStack(app, {
		requestId: {},
		tracing: requestTracing,
		metrics: requestMetricsCollector
			? {
					enabled: true,
					collector: requestMetricsCollector,
					skipPaths: ['/_health', '/internal/telemetry'],
				}
			: undefined,
		logger: {
			log: (data) => {
				if (data.path !== '/_health' && data.path !== '/internal/telemetry') {
					logger.info(
						{
							method: data.method,
							path: data.path,
							status: data.status,
							durationMs: data.durationMs,
						},
						'Request completed',
					);
				}
			},
		},
		rateLimit:
			rateLimitService && rateLimitConfig?.enabled
				? {
						enabled: true,
						service: rateLimitService,
						maxAttempts: rateLimitConfig.maxAttempts,
						windowMs: rateLimitConfig.windowMs,
						skipPaths: rateLimitConfig.skipPaths ?? ['/_health'],
					}
				: undefined,
		customMiddleware: [
			async (ctx, next) => {
				ctx.set('tempFiles', []);
				try {
					await next();
				} finally {
					const tempFiles = ctx.get('tempFiles') as Array<string>;
					await Promise.all(
						tempFiles.map((file: string) =>
							fs.unlink(file).catch(() => logger.error(`Failed to delete temp file: ${file}`)),
						),
					);
				}
			},
		],
		skipErrorHandler: true,
	});

	if (metrics) {
		app.use('*', createMetricsMiddleware(metrics));
	}

	const s3Client = createS3Client(config.s3);
	const s3Utils = createS3Utils(s3Client, metrics);
	const mimeTypeUtils = createMimeTypeUtils(logger);
	const codecValidator = createCodecValidator(logger);
	const ffmpegUtils = createFFmpegUtils({metrics, tracing});
	const frameExtractor = createFrameExtractor({tracing});
	const imageProcessor = createImageProcessor({metrics, tracing});
	const mediaValidator = createMediaValidator(mimeTypeUtils, codecValidator, ffmpegUtils);
	const mediaTransformService = createMediaTransformService({imageProcessor, ffmpegUtils, mimeTypeUtils});
	const httpClient = createHttpClient(FLUXER_USER_AGENT, {metrics, tracing});
	const coalescer = new InMemoryCoalescer({metrics, tracing});

	logger.info('Initialized in-memory request coalescer');

	const fetchForCloudflare = async (url: string, method: string) => {
		const response = await httpClient.sendRequest({url, method: method as 'GET' | 'POST' | 'HEAD'});
		return {status: response.status, stream: response.stream};
	};

	const cloudflareEdgeIPService = new CloudflareEdgeIPService(logger, fetchForCloudflare);

	if (config.requireCloudflareEdge) {
		await cloudflareEdgeIPService.initialize();
		logger.info('Initialized Cloudflare edge IP allowlist');
	} else {
		logger.info('Cloudflare edge IP allowlist disabled');
	}

	const cloudflareFirewall = createCloudflareFirewall(cloudflareEdgeIPService, logger, {
		enabled: config.requireCloudflareEdge,
	});

	app.use('*', cloudflareFirewall);

	app.get('/_health', (ctx) => ctx.text('OK'));

	app.get('/internal/telemetry', async (ctx) => {
		if (onTelemetryRequest) {
			return ctx.json(await onTelemetryRequest());
		}
		return ctx.json({
			telemetry_enabled: Boolean(metrics),
			service: 'fluxer_media_proxy',
			timestamp: new Date().toISOString(),
		});
	});

	let exposedServices: MediaProxyServices | undefined;

	if (config.staticMode) {
		logger.info('Media proxy running in STATIC MODE - proxying all requests to the static bucket');

		const handleStaticProxyRequest = createStaticProxyHandler({
			s3Utils,
			bucketStatic: config.s3.bucketStatic,
		});

		app.all('*', handleStaticProxyRequest);
	} else {
		const nsfwDetectionService = new NSFWDetectionService({
			modelPath: config.nsfwModelPath,
			nodeEnv: config.nodeEnv,
		});
		await nsfwDetectionService.initialize();
		logger.info('Initialized NSFW detection service');

		const metadataService = createMetadataService({
			coalescer,
			nsfwDetectionService,
			s3Utils,
			httpClient,
			mimeTypeUtils,
			mediaValidator,
			ffmpegUtils,
			logger,
			bucketUploads: config.s3.bucketUploads,
		});

		const frameService = createFrameService({
			s3Utils,
			mimeTypeUtils,
			frameExtractor,
			logger,
			bucketUploads: config.s3.bucketUploads,
		});

		exposedServices = {metadataService, frameService};

		const imageControllerDeps = {
			coalescer,
			s3Utils,
			mimeTypeUtils,
			imageProcessor,
			bucketCdn: config.s3.bucketCdn,
		};

		const handleImageRoute = createImageRouteHandler(imageControllerDeps);
		const handleSimpleImageRoute = createSimpleImageRouteHandler(imageControllerDeps);
		const handleGuildMemberImageRoute = createGuildMemberImageRouteHandler(imageControllerDeps);
		const handleStickerRoute = createStickerRouteHandler({
			coalescer,
			s3Utils,
			bucketCdn: config.s3.bucketCdn,
		});

		const processExternalMedia = createExternalMediaHandler({
			coalescer,
			httpClient,
			mimeTypeUtils,
			mediaValidator,
			mediaTransformService,
			logger,
			secretKey: config.secretKey,
			metrics,
			tracing,
		});

		const handleAttachmentsRoute = createAttachmentsHandler({
			coalescer,
			s3Client,
			s3Utils,
			mimeTypeUtils,
			mediaValidator,
			mediaTransformService,
			logger,
			bucketCdn: config.s3.bucketCdn,
		});

		const handleThemeRequest = createThemeHandler({
			s3Utils,
			bucketCdn: config.s3.bucketCdn,
		});

		if (!publicOnly) {
			const InternalNetworkRequired = createInternalNetworkRequired(config.secretKey);

			const handleMetadataRequest = createMetadataHandler({
				metadataService,
				logger,
			});

			const handleThumbnailRequest = createThumbnailHandler({
				s3Utils,
				mimeTypeUtils,
				ffmpegUtils,
				logger,
				bucketUploads: config.s3.bucketUploads,
			});

			const handleFrameExtraction = createFrameExtractionHandler({
				frameService,
				logger,
			});

			app.post('/_metadata', InternalNetworkRequired, handleMetadataRequest);
			app.post('/_thumbnail', InternalNetworkRequired, handleThumbnailRequest);
			app.post('/_frames', InternalNetworkRequired, handleFrameExtraction);
		}

		app.get('/avatars/:id/:filename', async (ctx) => handleImageRoute(ctx, 'avatars'));
		app.get('/icons/:id/:filename', async (ctx) => handleImageRoute(ctx, 'icons'));
		app.get('/banners/:id/:filename', async (ctx) => handleImageRoute(ctx, 'banners'));
		app.get('/splashes/:id/:filename', async (ctx) => handleImageRoute(ctx, 'splashes'));
		app.get('/embed-splashes/:id/:filename', async (ctx) => handleImageRoute(ctx, 'embed-splashes'));
		app.get('/emojis/:id', async (ctx) => handleSimpleImageRoute(ctx, 'emojis'));
		app.get('/stickers/:id', handleStickerRoute);
		app.get('/guilds/:guild_id/users/:user_id/avatars/:filename', async (ctx) =>
			handleGuildMemberImageRoute(ctx, 'avatars'),
		);
		app.get('/guilds/:guild_id/users/:user_id/banners/:filename', async (ctx) =>
			handleGuildMemberImageRoute(ctx, 'banners'),
		);
		app.get('/attachments/:channel_id/:attachment_id/:filename', handleAttachmentsRoute);
		app.get('/themes/:id.css', handleThemeRequest);

		app.get('/external/*', async (ctx) => {
			const fullPath = ctx.req.path;
			const externalIndex = fullPath.indexOf('/external/');
			if (externalIndex === -1) throw new HTTPException(400);
			const path = fullPath.substring(externalIndex + '/external/'.length);
			return processExternalMedia(ctx, path);
		});
	}

	const errorHandler = createErrorHandler({
		includeStack: false,
		logError: (err: unknown) => {
			const isExpectedError = err instanceof Error && 'isExpected' in err && err.isExpected;

			if (!(v.isValiError(err) || err instanceof SyntaxError || err instanceof HTTPException || isExpectedError)) {
				if (err instanceof Error) {
					captureException(err);
				}
				logger.error({err}, 'Unexpected error occurred');
			}
		},
		customHandler: (err: unknown, ctx) => {
			const isExpectedError = err instanceof Error && 'isExpected' in err && err.isExpected;

			if (v.isValiError(err) || err instanceof SyntaxError) {
				return ctx.text('Bad Request', {status: 400});
			}
			if (err instanceof HTTPException) {
				return err.getResponse();
			}
			if (isExpectedError) {
				logger.warn({err}, 'Expected error occurred');
				return ctx.text('Bad Request', {status: 400});
			}
			logger.error({err}, 'Unhandled error occurred');
			return ctx.text('Internal Server Error', {status: 500});
		},
	});

	app.onError(errorHandler);

	const shutdown = async () => {
		logger.info('Shutting down media proxy');
		cloudflareEdgeIPService.shutdown();
	};

	return {app, shutdown, services: exposedServices};
}
