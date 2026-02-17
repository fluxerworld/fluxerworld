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
import HttpClient from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import {
	STREAM_PREVIEW_CONTENT_TYPE_JPEG,
	STREAM_PREVIEW_REFRESH_INTERVAL_MS,
} from '@fluxer/constants/src/StreamConstants';
import {useCallback, useEffect, useState} from 'react';

const logger = new Logger('useStreamPreview');

const previewInflight = new Map<string, Promise<string | null>>();
const previewCache = new Map<string, {url: string; fetchedAt: number}>();
const PREVIEW_CACHE_MAX = 64;

interface StreamPreviewState {
	previewUrl: string | null;
	isPreviewLoading: boolean;
}

const isCacheFresh = (fetchedAt: number) => Date.now() - fetchedAt < STREAM_PREVIEW_REFRESH_INTERVAL_MS;

const touchCache = (streamKey: string, entry: {url: string; fetchedAt: number}) => {
	previewCache.delete(streamKey);
	previewCache.set(streamKey, entry);
};

const getCachedPreview = (streamKey: string) => {
	const entry = previewCache.get(streamKey);
	if (!entry) return null;
	if (!isCacheFresh(entry.fetchedAt)) return null;
	touchCache(streamKey, entry);
	return entry.url;
};

const setCachedPreview = (streamKey: string, url: string | null) => {
	if (!url) return;
	const existing = previewCache.get(streamKey);
	if (existing && existing.url !== url) {
		URL.revokeObjectURL(existing.url);
	}
	const entry = {url, fetchedAt: Date.now()};
	touchCache(streamKey, entry);
	if (previewCache.size <= PREVIEW_CACHE_MAX) return;
	const [oldestKey, oldestEntry] = previewCache.entries().next().value as [string, {url: string; fetchedAt: number}];
	previewCache.delete(oldestKey);
	URL.revokeObjectURL(oldestEntry.url);
};

export function useStreamPreview(enabled: boolean, streamKey: string): StreamPreviewState {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const fetchPreview = useCallback(async () => {
		const cached = getCachedPreview(streamKey);
		if (cached) {
			setLoading(false);
			setPreviewUrl(cached);
			return;
		}

		const staleEntry = previewCache.get(streamKey);
		const staleUrl = staleEntry?.url ?? null;

		const existing = previewInflight.get(streamKey);
		if (existing) {
			const url = await existing;
			if (url) {
				setCachedPreview(streamKey, url);
			}
			setPreviewUrl(url ?? staleUrl);
			return;
		}

		const p = (async () => {
			setLoading(true);
			try {
				const response = await HttpClient.get<ArrayBuffer>({
					url: Endpoints.STREAM_PREVIEW(streamKey),
					binary: true,
				});

				logger.debug('useStreamPreview: HTTP response', {
					ok: response.ok,
					status: response.status,
					hasBody: !!response.body,
					streamKey,
				});

				if (!response.ok || !response.body) return null;

				const contentType = response.headers['content-type'] || STREAM_PREVIEW_CONTENT_TYPE_JPEG;
				const blob = new Blob([response.body], {type: contentType});
				const url = URL.createObjectURL(blob);
				setCachedPreview(streamKey, url);
				return url;
			} catch (err) {
				logger.error('preview fetch failed', err);
				return null;
			} finally {
				setLoading(false);
			}
		})();

		previewInflight.set(streamKey, p);

		const url = await p.finally(() => previewInflight.delete(streamKey));
		logger.debug('useStreamPreview: fetch result', {url: url ? 'got url' : 'null', streamKey});
		setPreviewUrl(url ?? staleUrl);
	}, [streamKey]);

	useEffect(() => {
		if (!enabled) return;
		void fetchPreview();
		const intervalId = setInterval(() => {
			void fetchPreview();
		}, STREAM_PREVIEW_REFRESH_INTERVAL_MS);
		return () => clearInterval(intervalId);
	}, [enabled, fetchPreview]);

	useEffect(() => {
		if (enabled) return;
		setPreviewUrl(null);
	}, [enabled]);

	return {previewUrl, isPreviewLoading: loading};
}
