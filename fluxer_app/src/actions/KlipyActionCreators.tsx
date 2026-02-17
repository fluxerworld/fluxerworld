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
import * as LocaleUtils from '@app/utils/LocaleUtils';

const logger = new Logger('KLIPY');

const getLocale = (): string => LocaleUtils.getCurrentLocale();

export interface KlipyGif {
	id: string;
	title: string;
	url: string;
	src: string;
	proxy_src: string;
	width: number;
	height: number;
}

interface KlipyCategory {
	name: string;
	src: string;
	proxy_src: string;
}

export interface KlipyFeatured {
	categories: Array<KlipyCategory>;
	gifs: Array<KlipyGif>;
}

let klipyFeaturedCache: KlipyFeatured | null = null;

export async function search(q: string): Promise<Array<KlipyGif>> {
	try {
		logger.debug(`Searching for GIFs with query: "${q}"`);
		const response = await http.get<Array<KlipyGif>>({
			url: Endpoints.KLIPY_SEARCH,
			query: {q, locale: getLocale()},
		});
		const gifs = response.body;
		logger.debug(`Found ${gifs.length} GIFs for query "${q}"`);
		return gifs;
	} catch (error) {
		logger.error(`Failed to search for GIFs with query "${q}":`, error);
		throw error;
	}
}

export async function getFeatured(): Promise<KlipyFeatured> {
	if (klipyFeaturedCache) {
		logger.debug('Returning cached featured KLIPY content');
		return klipyFeaturedCache;
	}

	try {
		logger.debug('Fetching featured KLIPY content');
		const response = await http.get<KlipyFeatured>({
			url: Endpoints.KLIPY_FEATURED,
			query: {locale: getLocale()},
		});
		const featured = response.body;
		klipyFeaturedCache = featured;
		logger.debug(
			`Fetched featured KLIPY content: ${featured.categories.length} categories and ${featured.gifs.length} GIFs`,
		);
		return featured;
	} catch (error) {
		logger.error('Failed to fetch featured KLIPY content:', error);
		throw error;
	}
}

export async function getTrending(): Promise<Array<KlipyGif>> {
	try {
		logger.debug('Fetching trending KLIPY GIFs');
		const response = await http.get<Array<KlipyGif>>({
			url: Endpoints.KLIPY_TRENDING_GIFS,
			query: {locale: getLocale()},
		});
		const gifs = response.body;
		logger.debug(`Fetched ${gifs.length} trending KLIPY GIFs`);
		return gifs;
	} catch (error) {
		logger.error('Failed to fetch trending KLIPY GIFs:', error);
		throw error;
	}
}

export async function registerShare(id: string, q: string): Promise<void> {
	try {
		logger.debug(`Registering GIF share: id=${id}, query="${q}"`);
		await http.post({url: Endpoints.KLIPY_REGISTER_SHARE, body: {id, q, locale: getLocale()}});
		logger.debug(`Successfully registered GIF share for id=${id}`);
	} catch (error) {
		logger.error(`Failed to register GIF share for id=${id}:`, error);
	}
}

export async function suggest(q: string): Promise<Array<string>> {
	try {
		logger.debug(`Getting KLIPY search suggestions for: "${q}"`);
		const response = await http.get<Array<string>>({
			url: Endpoints.KLIPY_SUGGEST,
			query: {q, locale: getLocale()},
		});
		const suggestions = response.body;
		logger.debug(`Received ${suggestions.length} suggestions for query "${q}"`);
		return suggestions;
	} catch (error) {
		logger.error(`Failed to get suggestions for query "${q}":`, error);
		throw error;
	}
}
