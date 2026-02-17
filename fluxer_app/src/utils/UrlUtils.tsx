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

import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {buildMediaProxyURL, type MediaProxyOptions} from '@app/utils/MediaProxyUtils';

type QueryParamPrimitive = string | number | boolean;
type QueryParamValue = QueryParamPrimitive | null | undefined;

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

function applyQueryParams(url: URL, query: Record<string, QueryParamValue>) {
	for (const [key, value] of Object.entries(query)) {
		if (value === null || value === undefined) {
			continue;
		}
		url.searchParams.set(key, String(value));
	}
}

export function setUrlQueryParams(urlOrPath: string, query: Record<string, QueryParamValue>): string {
	const isAbsoluteUrl = ABSOLUTE_URL_PATTERN.test(urlOrPath) || urlOrPath.startsWith('//');
	const url = new URL(urlOrPath, window.location.origin);
	applyQueryParams(url, query);
	if (isAbsoluteUrl) {
		return url.toString();
	}
	return `${url.pathname}${url.search}${url.hash}`;
}

export function setPathQueryParams(path: string, query: Record<string, QueryParamValue>): string {
	const url = new URL(path, window.location.origin);
	applyQueryParams(url, query);
	const hasLeadingSlash = path.startsWith('/');
	const normalizedPath = hasLeadingSlash ? url.pathname : url.pathname.replace(/^\//, '');
	return `${normalizedPath}${url.search}${url.hash}`;
}

export function mediaUrl(path: string, options?: MediaProxyOptions): string {
	return buildMediaProxyURL(`${RuntimeConfigStore.mediaEndpoint}/${path}`, options);
}

export function cdnUrl(path: string): string {
	return buildMediaProxyURL(`${RuntimeConfigStore.staticCdnEndpoint}/${path}`);
}

export function webhookUrl(webhookId: string, token: string): string {
	return `${RuntimeConfigStore.apiPublicEndpoint}/webhooks/${webhookId}/${token}`;
}

export function marketingUrl(path: string): string {
	return `${RuntimeConfigStore.marketingEndpoint}/${path}`;
}

export function adminUrl(path: string): string {
	return `${RuntimeConfigStore.adminEndpoint}/${path}`;
}
