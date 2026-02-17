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

import {Logger} from '@app/lib/Logger';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {buildMediaProxyURL} from '@app/utils/MediaProxyUtils';
import {useEffect, useState} from 'react';

const logger = new Logger('useThemeExists');

export type ThemeExistsStatus = 'loading' | 'ready' | 'error';

const buildThemeUrl = (endpoint: string, themeId: string): string => {
	const base = endpoint.replace(/\/$/, '');
	return `${base}/themes/${themeId}.css`;
};

export const useThemeExists = (themeId: string | null | undefined): ThemeExistsStatus => {
	const [status, setStatus] = useState<ThemeExistsStatus>('loading');
	const mediaEndpoint = RuntimeConfigStore.mediaEndpoint;

	useEffect(() => {
		if (!mediaEndpoint || !themeId) {
			setStatus('loading');
			return;
		}

		let cancelled = false;

		const checkThemeExists = async () => {
			try {
				const response = await fetch(buildMediaProxyURL(buildThemeUrl(mediaEndpoint, themeId)), {method: 'HEAD'});
				if (!response.ok) throw new Error('Theme not found');
				if (cancelled) return;
				setStatus('ready');
			} catch (error) {
				if (cancelled) return;
				logger.error('Failed to check theme', error);
				setStatus('error');
			}
		};

		setStatus('loading');
		void checkThemeExists();

		return () => {
			cancelled = true;
		};
	}, [mediaEndpoint, themeId]);

	return status;
};
