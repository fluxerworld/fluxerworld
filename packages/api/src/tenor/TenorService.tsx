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

import {Config} from '@fluxer/api/src/Config';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {ITenorService} from '@fluxer/api/src/infrastructure/ITenorService';
import {Logger} from '@fluxer/api/src/Logger';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {FLUXER_USER_AGENT} from '@fluxer/constants/src/Core';
import type {TenorCategoryTagResponse, TenorGifResponse} from '@fluxer/schema/src/domains/tenor/TenorSchemas';
import {ms} from 'itty-time';

const TENOR_BASE_URL = 'https://tenor.googleapis.com/v2';
const DEFAULT_MEDIA_FILTER = 'webm,mp4';
const DEFAULT_CONTENT_FILTER = 'low';
const CLIENT_KEY = 'fluxer';
const MAX_RETRIES = 3;
const BACKOFF_BASE_DELAY = ms('1 second');
const CACHE_EXPIRATION_TIME = ms('5 minutes');

interface TenorMediaFormat {
	url: string;
	dims: [number, number];
}

interface TenorGif {
	id: string;
	title?: string;
	content_description?: string;
	media_formats?: Record<string, TenorMediaFormat>;
	itemurl?: string;
	url?: string;
}

interface TenorCategoryTag {
	searchterm: string;
	image: string;
}

type CacheEntry<T> = {
	data: T;
	timestamp: number;
};

export class TenorService implements ITenorService {
	private readonly FEATURED_CACHE_KEY = 'tenor:featured';
	private readonly TRENDING_CACHE_KEY = 'tenor:trending';

	private refreshingKeys: Map<string, boolean> = new Map();

	constructor(
		private cacheService: ICacheService,
		private mediaService: IMediaService,
	) {}

	private createURL({endpoint, params}: {endpoint: string; params: Record<string, string | number | undefined>}): URL {
		const url = new URL(`${TENOR_BASE_URL}/${endpoint}`);

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== '') {
				url.searchParams.append(key, value.toString());
			}
		}

		return url;
	}

	private async fetchTenorData<T>(url: URL): Promise<T> {
		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			try {
				const response = await fetch(url.toString(), {
					headers: {'User-Agent': FLUXER_USER_AGENT},
					signal: AbortSignal.timeout(ms('30 seconds')),
				});
				if (!response.ok) {
					throw new Error(`Failed to fetch Tenor data: ${response.statusText}`);
				}
				return response.json() as Promise<T>;
			} catch (error) {
				if (attempt < MAX_RETRIES - 1) {
					const delay = BACKOFF_BASE_DELAY * 2 ** attempt;
					await new Promise((resolve) => setTimeout(resolve, delay));
				} else {
					throw error;
				}
			}
		}
		throw new Error('Exceeded maximum retries');
	}

	private async fetchAndTransformGifs(url: URL): Promise<Array<TenorGifResponse>> {
		const {results} = await this.fetchTenorData<{results: Array<TenorGif>}>(url);
		return results.map((gif) => this.transformTenorGif(gif)).filter((gif): gif is TenorGifResponse => gif !== null);
	}

	private async getCache<T>(key: string): Promise<{data: T; isStale: boolean} | null> {
		const cached = await this.cacheService.get<CacheEntry<T>>(key);
		if (!cached) return null;
		const age = Date.now() - cached.timestamp;
		const isStale = age > CACHE_EXPIRATION_TIME;
		return {data: cached.data, isStale};
	}

	private async setCache<T>(key: string, data: T): Promise<void> {
		const cacheEntry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
		};
		await this.cacheService.set(key, cacheEntry);
	}

	private triggerBackgroundRefresh<T>(key: string, refreshFn: () => Promise<T>): void {
		if (this.refreshingKeys.get(key)) {
			return;
		}
		this.refreshingKeys.set(key, true);
		setImmediate(async () => {
			try {
				const freshData = await refreshFn();
				await this.setCache(key, freshData);
			} catch (error) {
				Logger.debug({key, error}, `Background refresh failed for key ${key}`);
			} finally {
				this.refreshingKeys.delete(key);
			}
		});
	}

	async search(params: {q: string; locale: string; country: string}): Promise<Array<TenorGifResponse>> {
		const url = this.createURL({
			endpoint: 'search',
			params: {
				key: Config.tenor.apiKey,
				client_key: CLIENT_KEY,
				q: params.q,
				country: params.country,
				locale: params.locale,
				contentfilter: DEFAULT_CONTENT_FILTER,
				media_filter: DEFAULT_MEDIA_FILTER,
				limit: 50,
			},
		});
		return this.fetchAndTransformGifs(url);
	}

	async registerShare(params: {id: string; q: string; locale: string; country: string}): Promise<void> {
		const url = this.createURL({
			endpoint: 'registershare',
			params: {
				key: Config.tenor.apiKey,
				client_key: CLIENT_KEY,
				id: params.id,
				country: params.country,
				locale: params.locale,
				q: params.q,
			},
		});
		await fetch(url.toString(), {
			headers: {'User-Agent': FLUXER_USER_AGENT},
			signal: AbortSignal.timeout(ms('30 seconds')),
		});
	}

	async getFeatured(params: {locale: string; country: string}): Promise<{
		gifs: Array<TenorGifResponse>;
		categories: Array<TenorCategoryTagResponse>;
	}> {
		const cached = await this.getCache<{
			gifs: Array<TenorGifResponse>;
			categories: Array<TenorCategoryTagResponse>;
		}>(this.FEATURED_CACHE_KEY);
		if (cached) {
			if (cached.isStale) {
				this.triggerBackgroundRefresh(this.FEATURED_CACHE_KEY, () => this.fetchFeaturedData(params));
			}
			return cached.data;
		}
		const data = await this.fetchFeaturedData(params);
		await this.setCache(this.FEATURED_CACHE_KEY, data);
		return data;
	}

	private async fetchFeaturedData(params: {locale: string; country: string}): Promise<{
		gifs: Array<TenorGifResponse>;
		categories: Array<TenorCategoryTagResponse>;
	}> {
		const [gifs, categories] = await Promise.all([this.getFeaturedGifs(params), this.getFeaturedCategories(params)]);
		return {gifs, categories};
	}

	async getTrendingGifs(params: {locale: string; country: string}): Promise<Array<TenorGifResponse>> {
		const cached = await this.getCache<Array<TenorGifResponse>>(this.TRENDING_CACHE_KEY);
		if (cached) {
			if (cached.isStale) {
				this.triggerBackgroundRefresh(this.TRENDING_CACHE_KEY, () => this.fetchTrendingGifs(params));
			}
			return cached.data;
		}
		const gifs = await this.fetchTrendingGifs(params);
		await this.setCache(this.TRENDING_CACHE_KEY, gifs);
		return gifs;
	}

	private async fetchTrendingGifs(params: {locale: string; country: string}): Promise<Array<TenorGifResponse>> {
		const url = this.createURL({
			endpoint: 'featured',
			params: {
				key: Config.tenor.apiKey,
				client_key: CLIENT_KEY,
				country: params.country,
				locale: params.locale,
				contentfilter: DEFAULT_CONTENT_FILTER,
				media_filter: DEFAULT_MEDIA_FILTER,
				limit: 50,
			},
		});
		return this.fetchAndTransformGifs(url);
	}

	async suggest(params: {q: string; locale: string}): Promise<Array<string>> {
		const url = this.createURL({
			endpoint: 'search_suggestions',
			params: {
				key: Config.tenor.apiKey,
				client_key: CLIENT_KEY,
				q: params.q,
				locale: params.locale,
				limit: 20,
			},
		});
		const {results} = await this.fetchTenorData<{results: Array<string>}>(url);
		return results;
	}

	private async getFeaturedGifs(params: {locale: string; country: string}): Promise<Array<TenorGifResponse>> {
		const url = this.createURL({
			endpoint: 'featured',
			params: {
				key: Config.tenor.apiKey,
				client_key: CLIENT_KEY,
				country: params.country,
				locale: params.locale,
				contentfilter: DEFAULT_CONTENT_FILTER,
				media_filter: DEFAULT_MEDIA_FILTER,
				limit: 1,
			},
		});
		return this.fetchAndTransformGifs(url);
	}

	private async getFeaturedCategories(params: {
		locale: string;
		country: string;
	}): Promise<Array<TenorCategoryTagResponse>> {
		const url = this.createURL({
			endpoint: 'categories',
			params: {
				key: Config.tenor.apiKey,
				client_key: CLIENT_KEY,
				country: params.country,
				locale: params.locale,
				contentfilter: DEFAULT_CONTENT_FILTER,
				type: 'featured',
			},
		});
		const {tags} = await this.fetchTenorData<{tags: Array<TenorCategoryTag>}>(url);
		return tags
			.filter((tag) => Boolean(tag.searchterm) && Boolean(tag.image))
			.map((tag) => ({
				name: tag.searchterm,
				src: tag.image,
				proxy_src: this.mediaService.getExternalMediaProxyURL(tag.image),
			}));
	}

	private selectMediaFormat(mediaFormats: Record<string, TenorMediaFormat> | undefined): TenorMediaFormat | null {
		if (!mediaFormats) {
			return null;
		}

		const preferredKeys = ['webm', 'mp4', 'tinywebm', 'tinymp4', 'webp', 'gif', 'tinygif', 'nanogif'];

		for (const key of preferredKeys) {
			const candidate = mediaFormats[key];
			if (candidate?.url && candidate.dims?.length === 2) {
				return candidate;
			}
		}

		for (const candidate of Object.values(mediaFormats)) {
			if (candidate?.url && candidate.dims?.length === 2) {
				return candidate;
			}
		}

		return null;
	}

	private transformTenorGif(input: TenorGif): TenorGifResponse | null {
		const media = this.selectMediaFormat(input.media_formats);
		if (!media) {
			return null;
		}

		const title = input.title?.trim() || input.content_description?.trim() || '';
		const url = input.itemurl?.trim() || input.url?.trim() || `https://tenor.com/view/${encodeURIComponent(input.id)}`;

		return {
			id: input.id,
			title,
			url,
			src: media.url,
			proxy_src: this.mediaService.getExternalMediaProxyURL(media.url),
			width: media.dims[0],
			height: media.dims[1],
		};
	}
}
