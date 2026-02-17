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
import {vi} from 'vitest';

export interface MockMediaServiceConfig {
	shouldFailMetadata?: boolean;
	shouldFailFrameExtraction?: boolean;
	returnNullMetadata?: boolean;
	returnEmptyFrames?: boolean;
	metadata?: MediaProxyMetadataResponse;
	frames?: Array<{timestamp: number; mime_type: string; base64: string}>;
}

export class MockMediaService extends IMediaService {
	readonly getMetadataSpy = vi.fn();
	readonly extractFramesSpy = vi.fn();
	readonly getExternalMediaProxyURLSpy = vi.fn();
	readonly getThumbnailSpy = vi.fn();

	private config: MockMediaServiceConfig;

	private readonly defaultMetadata: MediaProxyMetadataResponse = {
		format: 'png',
		content_type: 'image/png',
		content_hash: 'abc123',
		size: 1024,
		width: 100,
		height: 100,
		nsfw: false,
		base64: Buffer.from('mock-image-data').toString('base64'),
	};

	private readonly defaultFrames = [
		{timestamp: 0, mime_type: 'image/jpeg', base64: Buffer.from('frame-0').toString('base64')},
		{timestamp: 1000, mime_type: 'image/jpeg', base64: Buffer.from('frame-1').toString('base64')},
	];

	constructor(config: MockMediaServiceConfig = {}) {
		super();
		this.config = config;
	}

	configure(config: MockMediaServiceConfig): void {
		this.config = {...this.config, ...config};
	}

	async getMetadata(request: MediaProxyMetadataRequest): Promise<MediaProxyMetadataResponse | null> {
		this.getMetadataSpy(request);
		if (this.config.shouldFailMetadata) {
			throw new Error('Mock metadata fetch failure');
		}
		if (this.config.returnNullMetadata) {
			return null;
		}
		return this.config.metadata ?? this.defaultMetadata;
	}

	async extractFrames(request: MediaProxyFrameRequest): Promise<MediaProxyFrameResponse> {
		this.extractFramesSpy(request);
		if (this.config.shouldFailFrameExtraction) {
			throw new Error('Mock frame extraction failure');
		}
		if (this.config.returnEmptyFrames) {
			return {frames: []};
		}
		return {frames: this.config.frames ?? this.defaultFrames};
	}

	getExternalMediaProxyURL(url: string): string {
		this.getExternalMediaProxyURLSpy(url);
		return url;
	}

	async getThumbnail(uploadFilename: string): Promise<Buffer | null> {
		this.getThumbnailSpy(uploadFilename);
		return null;
	}

	reset(): void {
		this.config = {};
		this.getMetadataSpy.mockClear();
		this.extractFramesSpy.mockClear();
		this.getExternalMediaProxyURLSpy.mockClear();
		this.getThumbnailSpy.mockClear();
	}
}
