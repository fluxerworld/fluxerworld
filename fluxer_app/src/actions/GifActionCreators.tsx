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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import RuntimeConfigStore, {type GifProvider} from '@app/stores/RuntimeConfigStore';
import * as LocaleUtils from '@app/utils/LocaleUtils';

const logger = new Logger('GIF');

const getLocale = (): string => LocaleUtils.getCurrentLocale();

export interface Gif {
	id: string;
	title: string;
	url: string;
	src: string;
	proxy_src: string;
	width: number;
	height: number;
}

interface GifCategory {
	name: string;
	src: string;
	proxy_src: string;
}

export interface GifFeatured {
	categories: Array<GifCategory>;
	gifs: Array<Gif>;
}

function getProvider(): GifProvider {
	return RuntimeConfigStore.gifProvider;
}

function getProviderEndpoints(provider: GifProvider): {
	search: string;
	featured: string;
	trending: string;
	registerShare: string;
	suggest: string;
} {
	if (provider === 'tenor') {
		return {
			search: Endpoints.TENOR_SEARCH,
			featured: Endpoints.TENOR_FEATURED,
			trending: Endpoints.TENOR_TRENDING_GIFS,
			registerShare: Endpoints.TENOR_REGISTER_SHARE,
			suggest: Endpoints.TENOR_SUGGEST,
		};
	}

	return {
		search: Endpoints.KLIPY_SEARCH,
		featured: Endpoints.KLIPY_FEATURED,
		trending: Endpoints.KLIPY_TRENDING_GIFS,
		registerShare: Endpoints.KLIPY_REGISTER_SHARE,
		suggest: Endpoints.KLIPY_SUGGEST,
	};
}

let featuredCache: Partial<Record<GifProvider, GifFeatured>> = {};

export async function search(q: string): Promise<Array<Gif>> {
	const provider = getProvider();
	const endpoints = getProviderEndpoints(provider);

	try {
		logger.debug({provider, q}, 'Searching for GIFs');
		const response = await http.get<Array<Gif>>({
			url: endpoints.search,
			query: {q, locale: getLocale()},
		});
		return response.body;
	} catch (error) {
		logger.error({provider, q, error}, 'Failed to search for GIFs');
		throw error;
	}
}

export async function getFeatured(): Promise<GifFeatured> {
	const provider = getProvider();
	const endpoints = getProviderEndpoints(provider);

	const cached = featuredCache[provider];
	if (cached) {
		logger.debug({provider}, 'Returning cached featured GIF content');
		return cached;
	}

	try {
		logger.debug({provider}, 'Fetching featured GIF content');
		const response = await http.get<GifFeatured>({
			url: endpoints.featured,
			query: {locale: getLocale()},
		});
		const featured = response.body;
		featuredCache[provider] = featured;
		return featured;
	} catch (error) {
		logger.error({provider, error}, 'Failed to fetch featured GIF content');
		throw error;
	}
}

export async function getTrending(): Promise<Array<Gif>> {
	const provider = getProvider();
	const endpoints = getProviderEndpoints(provider);

	try {
		logger.debug({provider}, 'Fetching trending GIFs');
		const response = await http.get<Array<Gif>>({
			url: endpoints.trending,
			query: {locale: getLocale()},
		});
		return response.body;
	} catch (error) {
		logger.error({provider, error}, 'Failed to fetch trending GIFs');
		throw error;
	}
}

export async function registerShare(id: string, q: string): Promise<void> {
	const provider = getProvider();
	const endpoints = getProviderEndpoints(provider);

	try {
		logger.debug({provider, id, q}, 'Registering GIF share');
		await http.post({url: endpoints.registerShare, body: {id, q, locale: getLocale()}});
	} catch (error) {
		// Share registration is best-effort; it should never block sending a GIF.
		logger.error({provider, id, error}, 'Failed to register GIF share');
	}
}

export async function suggest(q: string): Promise<Array<string>> {
	const provider = getProvider();
	const endpoints = getProviderEndpoints(provider);

	try {
		logger.debug({provider, q}, 'Getting GIF search suggestions');
		const response = await http.get<Array<string>>({
			url: endpoints.suggest,
			query: {q, locale: getLocale()},
		});
		return response.body;
	} catch (error) {
		logger.error({provider, q, error}, 'Failed to get GIF search suggestions');
		throw error;
	}
}

export function resetFeaturedCache(): void {
	featuredCache = {};
}
