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

import {HttpResponse, http} from 'msw';

interface WikiSummaryResponse {
	type: string;
	title: string;
	extract: string;
	thumbnail?: {
		source: string;
		width: number;
		height: number;
	};
	originalimage?: {
		source: string;
		width: number;
		height: number;
	};
	description?: string;
	pageid: number;
}

export interface WikipediaApiMockConfig {
	articles?: Map<string, WikiSummaryResponse>;
	defaultResponse?: WikiSummaryResponse;
}

export function createWikipediaApiHandlers(config: WikipediaApiMockConfig = {}) {
	const articles = config.articles ?? new Map();
	const defaultResponse = config.defaultResponse ?? {
		type: 'standard',
		title: 'Test Article',
		extract: 'This is a test article extract.',
		pageid: 12345,
	};

	return [
		http.get('https://:lang.wikipedia.org/api/rest_v1/page/summary/:title', ({params}) => {
			const title = params.title as string;
			const decodedTitle = decodeURIComponent(title);

			const article = articles.get(decodedTitle) ?? articles.get(title) ?? defaultResponse;

			return HttpResponse.json(article);
		}),
	];
}

export function createWikipediaArticle(options: {
	title: string;
	extract: string;
	pageid?: number;
	description?: string;
	thumbnail?: {
		source: string;
		width: number;
		height: number;
	};
	originalimage?: {
		source: string;
		width: number;
		height: number;
	};
}): WikiSummaryResponse {
	return {
		type: 'standard',
		title: options.title,
		extract: options.extract,
		pageid: options.pageid ?? 12345,
		description: options.description,
		thumbnail: options.thumbnail,
		originalimage: options.originalimage,
	};
}
