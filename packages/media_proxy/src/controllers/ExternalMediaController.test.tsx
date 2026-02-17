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

import type {HttpClient} from '@fluxer/http_client/src/HttpClientTypes';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {createExternalMediaHandler} from '@fluxer/media_proxy/src/controllers/ExternalMediaController';
import {InMemoryCoalescer} from '@fluxer/media_proxy/src/lib/InMemoryCoalescer';
import type {MediaTransformService} from '@fluxer/media_proxy/src/lib/MediaTransformService';
import type {MediaValidator} from '@fluxer/media_proxy/src/lib/MediaValidation';
import type {MimeTypeUtils} from '@fluxer/media_proxy/src/lib/MimeTypeUtils';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import {buildExternalMediaProxyPath} from '@fluxer/media_proxy_utils/src/ExternalMediaProxyPathCodec';
import {createSignature} from '@fluxer/media_proxy_utils/src/MediaProxyUtils';
import {Hono} from 'hono';
import {describe, expect, test, vi} from 'vitest';

const SOURCE_URL = 'https://media.tenor.com/HozyHCAac-kAAAAM/high-five-patrick-star.gif';
const SECRET_KEY = 'test-secret';

function createReadableStream(buffer: Buffer): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new Uint8Array(buffer));
			controller.close();
		},
	});
}

function createNoopLogger(): LoggerInterface {
	function trace(_obj: Record<string, unknown> | string, _msg?: string): void {}
	function debug(_obj: Record<string, unknown> | string, _msg?: string): void {}
	function info(_obj: Record<string, unknown> | string, _msg?: string): void {}
	function warn(_obj: Record<string, unknown> | string, _msg?: string): void {}
	function error(_obj: Record<string, unknown> | string, _msg?: string): void {}
	const logger: LoggerInterface = {
		trace,
		debug,
		info,
		warn,
		error,
		child: () => logger,
	};
	return logger;
}

function createMockMimeTypeUtils(): MimeTypeUtils {
	return {
		getMimeType: vi.fn(() => 'image/gif'),
		generateFilename: vi.fn(() => 'high-five-patrick-star.gif'),
		getMediaCategory: vi.fn(() => 'image'),
		getContentType: vi.fn(() => 'image/gif'),
	};
}

function createMockMediaValidator(): MediaValidator {
	return {
		validateMedia: vi.fn(async () => 'image/gif'),
		processMetadata: vi.fn(),
	};
}

function createMockHttpClient(sourceBuffer: Buffer): HttpClient {
	const sendRequest = vi.fn(async () => ({
		stream: createReadableStream(sourceBuffer),
		headers: new Headers(),
		status: 200,
		url: SOURCE_URL,
	}));

	return {
		request: sendRequest,
		sendRequest,
		streamToString: vi.fn(async () => ''),
	};
}

function createExternalProxyApp(params: {
	httpClient: HttpClient;
	mimeTypeUtils: MimeTypeUtils;
	mediaValidator: MediaValidator;
	mediaTransformService: MediaTransformService;
}): Hono<HonoEnv> {
	const app = new Hono<HonoEnv>();
	const handler = createExternalMediaHandler({
		coalescer: new InMemoryCoalescer(),
		httpClient: params.httpClient,
		mimeTypeUtils: params.mimeTypeUtils,
		mediaValidator: params.mediaValidator,
		mediaTransformService: params.mediaTransformService,
		logger: createNoopLogger(),
		secretKey: SECRET_KEY,
	});

	app.get('/external/*', async (ctx) => {
		const fullPath = ctx.req.path;
		const externalIndex = fullPath.indexOf('/external/');
		const path = fullPath.substring(externalIndex + '/external/'.length);
		return handler(ctx, path);
	});

	return app;
}

function createSignedProxyPath(url: string): string {
	const proxyUrlPath = buildExternalMediaProxyPath(url);
	const signature = createSignature(proxyUrlPath, SECRET_KEY);
	return `/external/${signature}/${proxyUrlPath}`;
}

describe('external media controller', () => {
	test('returns the original GIF bytes when no transformations are requested', async () => {
		const sourceBuffer = Buffer.from('GIF89a source', 'utf8');
		const transformedBuffer = Buffer.from('GIF89a transformed', 'utf8');
		const httpClient = createMockHttpClient(sourceBuffer);
		const mimeTypeUtils = createMockMimeTypeUtils();
		const mediaValidator = createMockMediaValidator();
		const mediaTransformService: MediaTransformService = {
			transformImage: vi.fn(async () => ({data: transformedBuffer, contentType: 'image/gif'})),
			transformVideoThumbnail: vi.fn(),
		};
		const app = createExternalProxyApp({
			httpClient,
			mimeTypeUtils,
			mediaValidator,
			mediaTransformService,
		});

		const response = await app.request(createSignedProxyPath(SOURCE_URL));
		const responseBody = Buffer.from(await response.arrayBuffer());

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/gif');
		expect(responseBody.equals(sourceBuffer)).toBe(true);
		expect(httpClient.sendRequest).toHaveBeenCalledWith({url: SOURCE_URL});
		expect(mediaTransformService.transformImage).not.toHaveBeenCalled();
	});

	test('transforms when explicit image transformations are requested', async () => {
		const sourceBuffer = Buffer.from('GIF89a source', 'utf8');
		const transformedBuffer = Buffer.from('GIF89a transformed', 'utf8');
		const httpClient = createMockHttpClient(sourceBuffer);
		const mimeTypeUtils = createMockMimeTypeUtils();
		const mediaValidator = createMockMediaValidator();
		const mediaTransformService: MediaTransformService = {
			transformImage: vi.fn(async () => ({data: transformedBuffer, contentType: 'image/gif'})),
			transformVideoThumbnail: vi.fn(),
		};
		const app = createExternalProxyApp({
			httpClient,
			mimeTypeUtils,
			mediaValidator,
			mediaTransformService,
		});

		const response = await app.request(`${createSignedProxyPath(SOURCE_URL)}?animated=true`);
		const responseBody = Buffer.from(await response.arrayBuffer());

		expect(response.status).toBe(200);
		expect(responseBody.equals(transformedBuffer)).toBe(true);
		expect(mediaTransformService.transformImage).toHaveBeenCalledTimes(1);
		expect(mediaTransformService.transformImage).toHaveBeenCalledWith(sourceBuffer, {
			width: undefined,
			height: undefined,
			format: undefined,
			quality: 'lossless',
			animated: true,
			fallbackContentType: 'image/gif',
		});
	});
});
