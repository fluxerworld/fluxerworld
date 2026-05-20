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
import type {MessageEmbed} from '@fluxer/schema/src/domains/message/EmbedSchemas';

const logger = new Logger('EmbedActionCreators');

// Plain URL extractor — same shape SpoilerUtils uses. Good enough for
// link preview detection; the unfurl endpoint will reject anything that
// isn't a valid http(s) URL anyway.
const URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;
const MAX_URLS_PER_MESSAGE = 5;

// In-memory cache mirroring the server's url-embed cache. Saves a network
// round-trip when the same URL recurs across messages in a session. Server
// also caches with a 24h TTL.
const cache = new Map<string, ReadonlyArray<MessageEmbed>>();

export function extractUrlsForUnfurl(content: string): Array<string> {
	if (!content) return [];
	const matches = content.match(URL_REGEX);
	if (!matches) return [];
	const seen = new Set<string>();
	const out: Array<string> = [];
	for (const raw of matches) {
		// Trim trailing punctuation that's almost certainly not part of the
		// URL ("look at https://x.com." -> drop the period).
		const trimmed = raw.replace(/[.,!?;:)\]}>'"`]+$/g, '');
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		out.push(trimmed);
		if (out.length >= MAX_URLS_PER_MESSAGE) break;
	}
	return out;
}

async function unfurlOne(url: string): Promise<ReadonlyArray<MessageEmbed>> {
	const cached = cache.get(url);
	if (cached) return cached;
	try {
		const response = await http.get<{embeds: Array<MessageEmbed>}>({
			url: Endpoints.UNFURL,
			query: {url},
		});
		const embeds = response.body?.embeds ?? [];
		cache.set(url, embeds);
		return embeds;
	} catch (err) {
		logger.warn('Unfurl failed', {url, err});
		// Cache the empty result so we don't hammer the server for known
		// failures within the same session.
		cache.set(url, []);
		return [];
	}
}

/**
 * Resolve link-preview embeds for a decrypted message body. Returns the
 * flattened concatenation of every URL's embeds (server can return more
 * than one embed per URL, e.g. an OG article + a twitter card).
 */
export async function unfurlEmbedsForContent(content: string): Promise<Array<MessageEmbed>> {
	const urls = extractUrlsForUnfurl(content);
	if (urls.length === 0) return [];
	const results = await Promise.all(urls.map((u) => unfurlOne(u)));
	const flat: Array<MessageEmbed> = [];
	for (const r of results) flat.push(...r);
	return flat;
}
