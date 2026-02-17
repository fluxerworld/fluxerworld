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

import {sources} from '@rspack/core';

function normalizeEndpoint(staticCdnEndpoint) {
	if (!staticCdnEndpoint) return '';
	return staticCdnEndpoint.endsWith('/') ? staticCdnEndpoint.slice(0, -1) : staticCdnEndpoint;
}

function generateManifest(staticCdnEndpointRaw) {
	const staticCdnEndpoint = normalizeEndpoint(staticCdnEndpointRaw);

	const manifest = {
		name: 'Fluxer',
		short_name: 'Fluxer',
		description:
			'Fluxer is a free and open source instant messaging and VoIP platform built for friends, groups, and communities.',
		start_url: '/',
		display: 'standalone',
		orientation: 'portrait-primary',
		theme_color: '#4641D9',
		background_color: '#2b2d31',
		categories: ['social', 'communication'],
		lang: 'en',
		scope: '/',
		icons: [
			{
				src: `${staticCdnEndpoint}/web/android-chrome-192x192.png`,
				sizes: '192x192',
				type: 'image/png',
				purpose: 'maskable any',
			},
			{
				src: `${staticCdnEndpoint}/web/android-chrome-512x512.png`,
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable any',
			},
			{
				src: `${staticCdnEndpoint}/web/apple-touch-icon.png`,
				sizes: '180x180',
				type: 'image/png',
			},
			{
				src: `${staticCdnEndpoint}/web/favicon-32x32.png`,
				sizes: '32x32',
				type: 'image/png',
			},
			{
				src: `${staticCdnEndpoint}/web/favicon-16x16.png`,
				sizes: '16x16',
				type: 'image/png',
			},
		],
	};

	return JSON.stringify(manifest, null, 2);
}

function generateBrowserConfig(staticCdnEndpointRaw) {
	const staticCdnEndpoint = normalizeEndpoint(staticCdnEndpointRaw);

	return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="${staticCdnEndpoint}/web/mstile-150x150.png"/>
      <TileColor>#4641D9</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;
}

function generateRobotsTxt() {
	return 'User-agent: *\nAllow: /\n';
}

export class StaticFilesPlugin {
	constructor(options) {
		this.staticCdnEndpoint = options?.staticCdnEndpoint ?? '';
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap('StaticFilesPlugin', (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'StaticFilesPlugin',
					stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				},
				() => {
					compilation.emitAsset('manifest.json', new sources.RawSource(generateManifest(this.staticCdnEndpoint)));
					compilation.emitAsset(
						'browserconfig.xml',
						new sources.RawSource(generateBrowserConfig(this.staticCdnEndpoint)),
					);
					compilation.emitAsset('robots.txt', new sources.RawSource(generateRobotsTxt()));
				},
			);
		});
	}
}

export function staticFilesPlugin(options) {
	return new StaticFilesPlugin(options);
}
