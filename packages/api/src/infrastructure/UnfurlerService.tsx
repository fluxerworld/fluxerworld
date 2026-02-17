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

import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import {IUnfurlerService} from '@fluxer/api/src/infrastructure/IUnfurlerService';
import {Logger} from '@fluxer/api/src/Logger';
import {AudioResolver} from '@fluxer/api/src/unfurler/resolvers/AudioResolver';
import type {BaseResolver} from '@fluxer/api/src/unfurler/resolvers/BaseResolver';
import {BlueskyResolver} from '@fluxer/api/src/unfurler/resolvers/BlueskyResolver';
import {DefaultResolver} from '@fluxer/api/src/unfurler/resolvers/DefaultResolver';
import {HackerNewsResolver} from '@fluxer/api/src/unfurler/resolvers/HackerNewsResolver';
import {ImageResolver} from '@fluxer/api/src/unfurler/resolvers/ImageResolver';
import {KlipyResolver} from '@fluxer/api/src/unfurler/resolvers/KlipyResolver';
import {TenorResolver} from '@fluxer/api/src/unfurler/resolvers/TenorResolver';
import {VideoResolver} from '@fluxer/api/src/unfurler/resolvers/VideoResolver';
import {WikipediaResolver} from '@fluxer/api/src/unfurler/resolvers/WikipediaResolver';
import {XkcdResolver} from '@fluxer/api/src/unfurler/resolvers/XkcdResolver';
import {YouTubeResolver} from '@fluxer/api/src/unfurler/resolvers/YouTubeResolver';
import * as FetchUtils from '@fluxer/api/src/utils/FetchUtils';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {FLUXER_USER_AGENT} from '@fluxer/constants/src/Core';
import type {MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {HTTPException} from 'hono/http-exception';
import {ms} from 'itty-time';
import {filetypemime} from 'magic-bytes.js';

export class UnfurlerService extends IUnfurlerService {
	private readonly resolvers: Array<BaseResolver>;
	private static readonly UNFURL_REQUEST_HEADERS = {'User-Agent': FLUXER_USER_AGENT};

	constructor(
		private cacheService: ICacheService,
		private mediaService: IMediaService,
	) {
		super();
		this.resolvers = [
			new AudioResolver(this.mediaService),
			new HackerNewsResolver(this.mediaService),
			new ImageResolver(this.mediaService),
			new KlipyResolver(this.mediaService),
			new TenorResolver(this.mediaService),
			new VideoResolver(this.mediaService),
			new XkcdResolver(this.mediaService),
			new YouTubeResolver(this.mediaService),
			new WikipediaResolver(this.mediaService),
			new BlueskyResolver(this.cacheService, this.mediaService),
			new DefaultResolver(this.cacheService, this.mediaService),
		];
	}

	async unfurl(url: string, isNSFWAllowed: boolean = false): Promise<Array<MessageEmbedResponse>> {
		try {
			const originalUrl = new URL(url);
			const {fetchUrl, matchingResolver} = this.getUrlToFetch(originalUrl);
			const response = await FetchUtils.sendRequest({
				url: fetchUrl.href,
				timeout: ms('10 seconds'),
				headers: UnfurlerService.UNFURL_REQUEST_HEADERS,
			});
			if (response.status !== 200) {
				Logger.debug({url: fetchUrl.href, status: response.status}, 'Non-200 response received');
				return [];
			}
			const contentBuffer = await this.streamToBuffer(response.stream);
			const mimeType = this.determineMimeType(contentBuffer, response.headers);
			if (!mimeType) {
				Logger.error({url: fetchUrl.href}, 'Unable to determine MIME type');
				return [];
			}
			const finalUrl = new URL(response.url);
			if (matchingResolver) {
				return matchingResolver.resolve(originalUrl, contentBuffer, isNSFWAllowed);
			}
			for (const resolver of this.resolvers) {
				if (resolver.match(finalUrl, mimeType, contentBuffer)) {
					if (resolver instanceof DefaultResolver) {
						return resolver.resolve(finalUrl, contentBuffer, isNSFWAllowed, {
							requestUrl: fetchUrl,
							finalUrl,
							wasRedirected: fetchUrl.href !== finalUrl.href,
						});
					}
					return resolver.resolve(finalUrl, contentBuffer, isNSFWAllowed);
				}
			}
			return [];
		} catch (error) {
			Logger.error({error, url}, 'Failed to unfurl URL');
			return [];
		}
	}

	private getUrlToFetch(url: URL): {fetchUrl: URL; matchingResolver: BaseResolver | null} {
		for (const resolver of this.resolvers) {
			const transformedUrl = resolver.transformUrl(url);
			if (transformedUrl) {
				return {fetchUrl: transformedUrl, matchingResolver: resolver};
			}
		}
		return {fetchUrl: url, matchingResolver: null};
	}

	private async streamToBuffer(stream: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
		if (!stream) {
			return new Uint8Array(0);
		}

		const MAX_STREAM_BYTES = 500 * 1024 * 1024;
		const chunks: Array<Uint8Array> = [];
		let totalSize = 0;
		const reader = stream.getReader();

		try {
			while (true) {
				const {done, value} = await reader.read();
				if (done) break;
				if (value) {
					totalSize += value.length;
					if (totalSize > MAX_STREAM_BYTES) {
						throw new HTTPException(413, {
							message: 'Stream size exceeds maximum allowed for unfurling',
						});
					}
					chunks.push(value);
				}
			}
		} finally {
			reader.releaseLock();
		}

		const result = new Uint8Array(totalSize);
		let offset = 0;
		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}
		return result;
	}

	private determineMimeType(content: Uint8Array, headers: Headers): string | undefined {
		const headerMimeType = headers.get('content-type')?.split(';')[0];
		if (headerMimeType) return headerMimeType;
		const [mimeTypeFromMagicBytes] = filetypemime(new Uint8Array(content));
		return mimeTypeFromMagicBytes;
	}
}
