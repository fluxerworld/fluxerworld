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

import crypto from 'node:crypto';
import {Config} from '@fluxer/api/src/Config';
import {
	IMediaService,
	type MediaProxyFrameRequest,
	type MediaProxyFrameResponse,
	type MediaProxyMetadataRequest,
	type MediaProxyMetadataResponse,
} from '@fluxer/api/src/infrastructure/IMediaService';
import type {S3Service} from '@fluxer/s3/src/s3/S3Service';

export class TestMediaService extends IMediaService {
	private s3Service: S3Service | null = null;

	setS3Service(s3Service: S3Service): void {
		this.s3Service = s3Service;
	}

	async getMetadata(request: MediaProxyMetadataRequest): Promise<MediaProxyMetadataResponse | null> {
		if (request.type === 'base64') {
			return this.analyzeBase64Image(request.base64);
		}

		if (request.type === 's3') {
			return {
				format: 'png',
				content_type: 'image/png',
				content_hash: crypto.createHash('md5').update(request.key).digest('hex'),
				size: 1024,
				width: 128,
				height: 128,
				animated: false,
				nsfw: false,
			};
		}

		if (request.type === 'upload') {
			const filename = request.upload_filename.toLowerCase();
			const format = this.getFormatFromFilename(filename);
			let size = 1024;
			if (this.s3Service) {
				try {
					const metadata = await this.s3Service.headObject(Config.s3.buckets.uploads, request.upload_filename);
					size = metadata.size;
				} catch {
					size = 1024;
				}
			}
			return {
				format,
				content_type: `image/${format}`,
				content_hash: crypto.createHash('md5').update(request.upload_filename).digest('hex'),
				size,
				width: 128,
				height: 128,
				animated: format === 'gif',
				nsfw: false,
			};
		}

		if (request.type === 'external') {
			return {
				format: 'png',
				content_type: 'image/png',
				content_hash: crypto.createHash('md5').update(request.url).digest('hex'),
				size: 1024,
				width: 128,
				height: 128,
				animated: false,
				nsfw: false,
			};
		}

		return null;
	}

	getExternalMediaProxyURL(): string {
		return 'https://media-proxy.test';
	}

	async getThumbnail(): Promise<Buffer | null> {
		return Buffer.alloc(1024);
	}

	async extractFrames(_request: MediaProxyFrameRequest): Promise<MediaProxyFrameResponse> {
		return {
			frames: [
				{
					timestamp: 0,
					mime_type: 'image/png',
					base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				},
			],
		};
	}

	private analyzeBase64Image(base64: string): MediaProxyMetadataResponse | null {
		try {
			const buffer = Buffer.from(base64, 'base64');

			if (buffer.length === 0) {
				return null;
			}

			const format = this.detectImageFormat(buffer);
			if (!format) {
				return null;
			}

			return {
				format,
				content_type: `image/${format}`,
				content_hash: crypto.createHash('md5').update(buffer).digest('hex'),
				size: buffer.length,
				width: 128,
				height: 128,
				animated: format === 'gif',
				nsfw: false,
			};
		} catch (_error) {
			return null;
		}
	}

	private detectImageFormat(buffer: Buffer): string | null {
		if (buffer.length < 12) {
			return null;
		}

		const first12Bytes = buffer.subarray(0, 12);

		if (this.isPng(first12Bytes)) {
			return 'png';
		}

		if (this.isGif(first12Bytes)) {
			return 'gif';
		}

		if (this.isWebP(first12Bytes)) {
			return 'webp';
		}

		if (this.isJpeg(first12Bytes)) {
			return 'jpeg';
		}

		return null;
	}

	private isPng(bytes: Buffer): boolean {
		return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
	}

	private isGif(bytes: Buffer): boolean {
		return (
			bytes[0] === 0x47 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x38 &&
			(bytes[4] === 0x37 || bytes[4] === 0x39) &&
			bytes[5] === 0x61
		);
	}

	private isWebP(bytes: Buffer): boolean {
		return (
			bytes[0] === 0x52 &&
			bytes[1] === 0x49 &&
			bytes[2] === 0x46 &&
			bytes[3] === 0x46 &&
			bytes[8] === 0x57 &&
			bytes[9] === 0x45 &&
			bytes[10] === 0x42 &&
			bytes[11] === 0x50
		);
	}

	private isJpeg(bytes: Buffer): boolean {
		return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	}

	private getFormatFromFilename(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase() ?? 'png';
		if (['png', 'gif', 'webp', 'jpeg', 'jpg'].includes(ext)) {
			return ext === 'jpg' ? 'jpeg' : ext;
		}
		return 'png';
	}
}
