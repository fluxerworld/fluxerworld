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

import {Readable} from 'node:stream';
import {DownloadService} from '@fluxer/api/src/download/DownloadService';
import {MockStorageService} from '@fluxer/api/src/test/mocks/MockStorageService';
import {beforeEach, describe, expect, it, vi} from 'vitest';

function buildManifest(dmg: string): string {
	return JSON.stringify({
		channel: 'stable',
		platform: 'darwin',
		arch: 'x64',
		version: '0.0.8',
		pub_date: '2026-01-06T01:03:26Z',
		files: {
			setup: '',
			dmg,
			zip: '',
			appimage: '',
			deb: '',
			rpm: '',
			tar_gz: '',
		},
	});
}

describe('DownloadService.resolveLatestDesktopRedirect', () => {
	let storageService: MockStorageService;
	let downloadService: DownloadService;

	beforeEach(() => {
		storageService = new MockStorageService();
		downloadService = new DownloadService(storageService);
	});

	it('falls back to x64 artefact when manifest points to arm64 file', async () => {
		const manifestKey = 'desktop/stable/darwin/x64/manifest.json';
		const manifestBody = buildManifest('fluxer-stable-0.0.8-arm64.dmg');

		vi.spyOn(storageService, 'streamObject').mockImplementation(async (params) => {
			if (params.key !== manifestKey) {
				return null;
			}

			return {
				body: Readable.from([Buffer.from(manifestBody, 'utf-8')]),
				contentLength: manifestBody.length,
				contentType: 'application/json',
			};
		});

		const listObjects = vi
			.spyOn(storageService, 'listObjects')
			.mockResolvedValue([
				{key: 'desktop/stable/darwin/x64/fluxer-stable-0.0.8-arm64.dmg'},
				{key: 'desktop/stable/darwin/x64/fluxer-stable-0.0.8-x64.dmg'},
			]);

		const result = await downloadService.resolveLatestDesktopRedirect({
			channel: 'stable',
			plat: 'darwin',
			arch: 'x64',
			format: 'dmg',
			host: 'api.fluxer.app',
			forwardedProto: 'https',
			requestUrl: 'https://api.fluxer.app/dl/desktop/stable/darwin/x64/latest/dmg',
		});

		expect(result).toBe('https://api.fluxer.app/dl/desktop/stable/darwin/x64/fluxer-stable-0.0.8-x64.dmg');
		expect(listObjects).toHaveBeenCalledTimes(1);
	});

	it('uses manifest filename directly when architecture already matches', async () => {
		const manifestKey = 'desktop/stable/darwin/x64/manifest.json';
		const manifestBody = buildManifest('fluxer-stable-0.0.8-x64.dmg');

		vi.spyOn(storageService, 'streamObject').mockImplementation(async (params) => {
			if (params.key !== manifestKey) {
				return null;
			}

			return {
				body: Readable.from([Buffer.from(manifestBody, 'utf-8')]),
				contentLength: manifestBody.length,
				contentType: 'application/json',
			};
		});

		const result = await downloadService.resolveLatestDesktopRedirect({
			channel: 'stable',
			plat: 'darwin',
			arch: 'x64',
			format: 'dmg',
			host: 'api.fluxer.app',
			forwardedProto: 'https',
			requestUrl: 'https://api.fluxer.app/dl/desktop/stable/darwin/x64/latest/dmg',
		});

		expect(result).toBe('https://api.fluxer.app/dl/desktop/stable/darwin/x64/fluxer-stable-0.0.8-x64.dmg');
		expect(storageService.listObjectsSpy).not.toHaveBeenCalled();
	});
});
