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

import {randomBytes} from 'node:crypto';
import {Config} from '@fluxer/api/src/Config';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import {FileSizeTooLargeError} from '@fluxer/errors/src/domains/core/FileSizeTooLargeError';

const MAX_CSS_BYTES = 8 * 1024 * 1024;

export class ThemeService {
	constructor(private readonly storageService: IStorageService) {}

	async createTheme(css: string): Promise<{id: string}> {
		const cssBytes = Buffer.from(css, 'utf-8');

		if (cssBytes.length > MAX_CSS_BYTES) {
			throw new FileSizeTooLargeError();
		}

		const themeId = randomBytes(8).toString('hex');
		await this.storageService.uploadObject({
			bucket: Config.s3.buckets.cdn,
			key: `themes/${themeId}.css`,
			body: cssBytes,
			contentType: 'text/css; charset=utf-8',
		});

		getMetricsService().counter({
			name: 'fluxer.themes.custom_theme_created',
			dimensions: {
				css_size_bytes: cssBytes.length.toString(),
			},
		});

		return {id: themeId};
	}
}
