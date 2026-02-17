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

import {
	IMediaService,
	type MediaProxyFrameRequest,
	type MediaProxyFrameResponse,
	type MediaProxyMetadataRequest,
	type MediaProxyMetadataResponse,
} from '@fluxer/api/src/infrastructure/IMediaService';
import {ExplicitContentCannotBeSentError} from '@fluxer/errors/src/domains/moderation/ExplicitContentCannotBeSentError';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {IFrameService, IMetadataService} from '@fluxer/media_proxy/src/types/MediaProxyServices';
import {
	createExternalMediaProxyUrlBuilder,
	type IExternalMediaProxyUrlBuilder,
} from '@fluxer/media_proxy_utils/src/ExternalMediaProxyUrlBuilder';

export interface DirectMediaServiceOptions {
	metadataService: IMetadataService;
	frameService: IFrameService;
	mediaProxyEndpoint: string;
	mediaProxySecretKey: string;
	logger: LoggerInterface;
}

export class DirectMediaService extends IMediaService {
	private readonly metadataService: IMetadataService;
	private readonly frameService: IFrameService;
	private readonly proxyURL: URL;
	private readonly logger: LoggerInterface;
	private readonly externalMediaProxyUrlBuilder: IExternalMediaProxyUrlBuilder;

	constructor(options: DirectMediaServiceOptions) {
		super();
		this.metadataService = options.metadataService;
		this.frameService = options.frameService;
		this.proxyURL = new URL(options.mediaProxyEndpoint);
		this.logger = options.logger;
		this.externalMediaProxyUrlBuilder = createExternalMediaProxyUrlBuilder({
			mediaProxyEndpoint: options.mediaProxyEndpoint,
			mediaProxySecretKey: options.mediaProxySecretKey,
		});
	}

	async getMetadata(request: MediaProxyMetadataRequest): Promise<MediaProxyMetadataResponse | null> {
		try {
			const metadata = await this.metadataService.getMetadata(request);

			if (!request.isNSFWAllowed && metadata.nsfw) {
				throw new ExplicitContentCannotBeSentError(metadata.nsfw_probability ?? 0, metadata.nsfw_predictions ?? {});
			}

			return {
				...metadata,
				format: metadata.format.toLowerCase(),
			};
		} catch (error) {
			if (error instanceof ExplicitContentCannotBeSentError) {
				throw error;
			}
			this.logger.error({error}, 'Failed to get media metadata directly');
			return null;
		}
	}

	getExternalMediaProxyURL(url: string): string {
		let urlObj: URL;
		try {
			urlObj = new URL(url);
		} catch (_e) {
			return this.handleExternalURL(url);
		}

		if (urlObj.host === this.proxyURL.host) {
			return url;
		}

		return this.handleExternalURL(url);
	}

	async getThumbnail(uploadFilename: string): Promise<Buffer | null> {
		try {
			return await this.metadataService.getThumbnail({upload_filename: uploadFilename});
		} catch (error) {
			this.logger.error({error, uploadFilename}, 'Failed to get thumbnail directly');
			return null;
		}
	}

	async extractFrames(request: MediaProxyFrameRequest): Promise<MediaProxyFrameResponse> {
		return await this.frameService.extractFrames(request);
	}

	private handleExternalURL(url: string): string {
		return this.externalMediaProxyUrlBuilder.buildExternalMediaProxyUrl(url);
	}
}
