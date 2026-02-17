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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {readMarketingResponseAsText, sendMarketingRequest} from '@fluxer/marketing/src/MarketingHttpClient';
import type {Context} from 'hono';

export const productHuntFeaturedUrl =
	'https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1057558&theme=light';
export const productHuntTopPostUrl =
	'https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=1057558&theme=light&period=daily&t=1767529639613';

const staleAfterMs = 300_000;
const fetchTimeoutMs = 4_500;

export interface BadgeCache {
	getBadge(): Promise<string | null>;
}

interface CacheEntry {
	svg: string;
	fetchedAt: number;
}

export function createBadgeCache(url: string): BadgeCache {
	let cache: CacheEntry | null = null;
	let isRefreshing = false;

	async function refreshBadge(): Promise<void> {
		if (isRefreshing) return;
		isRefreshing = true;
		try {
			const svg = await fetchBadgeSvg(url);
			if (svg) {
				cache = {svg, fetchedAt: Date.now()};
			}
		} finally {
			isRefreshing = false;
		}
	}

	return {
		async getBadge() {
			const now = Date.now();
			if (!cache) {
				const svg = await fetchBadgeSvg(url);
				if (svg) {
					cache = {svg, fetchedAt: now};
				}
				return svg;
			}

			const isStale = now - cache.fetchedAt > staleAfterMs;
			if (isStale) {
				void refreshBadge();
			}
			return cache.svg;
		},
	};
}

export async function createBadgeResponse(cache: BadgeCache, c: Context): Promise<Response> {
	const svg = await cache.getBadge();
	if (!svg) {
		c.header('content-type', 'text/plain');
		c.header('retry-after', '60');
		return c.text('Badge temporarily unavailable', 503);
	}

	c.header('content-type', 'image/svg+xml');
	c.header('cache-control', 'public, max-age=300, stale-while-revalidate=600');
	c.header('vary', 'Accept');
	return c.body(svg, 200);
}

async function fetchBadgeSvg(url: string): Promise<string | null> {
	try {
		const response = await sendMarketingRequest({
			url,
			method: 'GET',
			headers: {
				Accept: 'image/svg+xml',
			},
			timeout: fetchTimeoutMs,
			serviceName: 'marketing_badges',
		});
		if (response.status < 200 || response.status >= 300) return null;
		return await readMarketingResponseAsText(response.stream);
	} catch {
		return null;
	}
}
