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

import {buildExternalMediaProxyPath} from '@fluxer/media_proxy_utils/src/ExternalMediaProxyPathCodec';
import {createMediaProxySigner, type IMediaProxySigner} from '@fluxer/media_proxy_utils/src/MediaProxySigner';

export interface ExternalMediaProxyUrlBuilderOptions {
	mediaProxyEndpoint: string;
	mediaProxySecretKey: string;
}

export interface IExternalMediaProxyUrlBuilder {
	buildExternalMediaProxyUrl(inputUrl: string): string;
}

interface InternalExternalMediaProxyUrlBuilderOptions {
	mediaProxyEndpoint: string;
	mediaProxySigner: IMediaProxySigner;
}

function normalizeMediaProxyEndpoint(mediaProxyEndpoint: string): string {
	return mediaProxyEndpoint.replace(/\/+$/u, '');
}

class ExternalMediaProxyUrlBuilder implements IExternalMediaProxyUrlBuilder {
	private readonly mediaProxyEndpoint: string;
	private readonly mediaProxySigner: IMediaProxySigner;

	constructor(options: InternalExternalMediaProxyUrlBuilderOptions) {
		this.mediaProxyEndpoint = options.mediaProxyEndpoint;
		this.mediaProxySigner = options.mediaProxySigner;
	}

	buildExternalMediaProxyUrl(inputUrl: string): string {
		const proxyUrlPath = buildExternalMediaProxyPath(inputUrl);
		const signature = this.mediaProxySigner.createSignature(proxyUrlPath);
		return `${this.mediaProxyEndpoint}/external/${signature}/${proxyUrlPath}`;
	}
}

export function createExternalMediaProxyUrlBuilder(
	options: ExternalMediaProxyUrlBuilderOptions,
): IExternalMediaProxyUrlBuilder {
	const mediaProxySigner = createMediaProxySigner({
		mediaProxySecretKey: options.mediaProxySecretKey,
	});

	return new ExternalMediaProxyUrlBuilder({
		mediaProxyEndpoint: normalizeMediaProxyEndpoint(options.mediaProxyEndpoint),
		mediaProxySigner,
	});
}
