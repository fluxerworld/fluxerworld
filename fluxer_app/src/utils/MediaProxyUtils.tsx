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

export interface MediaProxyOptions {
	width?: number;
	height?: number;
	format?: string;
	quality?: 'high' | 'low' | 'lossless';
	animated?: boolean;
}

function appendMediaProxyParams(url: URL, options: MediaProxyOptions): void {
	const {width, height, format, quality, animated} = options;

	if (format) {
		url.searchParams.append('format', format);
	}
	if (width !== undefined) {
		url.searchParams.append('width', width.toString());
	}
	if (height !== undefined) {
		url.searchParams.append('height', height.toString());
	}
	if (quality) {
		url.searchParams.append('quality', quality);
	}
	if (animated !== undefined) {
		url.searchParams.append('animated', animated.toString());
	}
}

export function buildMediaProxyURL(originalUrl: string, options: MediaProxyOptions = {}): string {
	if (!originalUrl) return originalUrl;

	const url = new URL(originalUrl);
	appendMediaProxyParams(url, options);
	return url.toString();
}

export function stripMediaProxyParams(proxyURL: string): string {
	const url = new URL(proxyURL);
	url.searchParams.delete('width');
	url.searchParams.delete('height');
	url.searchParams.delete('format');
	url.searchParams.delete('quality');
	url.searchParams.delete('animated');
	return url.toString();
}
