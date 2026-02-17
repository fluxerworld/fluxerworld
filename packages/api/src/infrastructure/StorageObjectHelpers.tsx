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

import {execFile} from 'node:child_process';
import fs from 'node:fs';
import type {Readable as NodeReadable} from 'node:stream';
import {promisify} from 'node:util';
import {Logger} from '@fluxer/api/src/Logger';
import sharp from 'sharp';
import {temporaryFile} from 'tempy';

const execFilePromise = promisify(execFile);

export interface JpegUploadTarget {
	bucket: string;
	key: string;
}

export interface JpegUploadRequest {
	sourceData: Uint8Array;
	contentType: string;
	destination: JpegUploadTarget;
	uploadObject: (params: {bucket: string; key: string; body: Uint8Array; contentType?: string}) => Promise<void>;
}

export async function streamToBuffer(stream: NodeReadable, maxBytes = 50 * 1024 * 1024): Promise<Uint8Array> {
	const chunks: Array<Uint8Array> = [];
	let totalSize = 0;

	try {
		for await (const chunk of stream) {
			const chunkBuffer = new Uint8Array(Buffer.from(chunk));
			totalSize += chunkBuffer.length;

			if (totalSize > maxBytes) {
				stream.destroy();
				throw new Error(`Stream exceeds maximum buffer size of ${maxBytes} bytes (got ${totalSize} bytes)`);
			}

			chunks.push(chunkBuffer);
		}

		return new Uint8Array(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
	} catch (error) {
		if (!stream.destroyed) {
			stream.destroy();
		}
		throw error;
	}
}

export async function processAndUploadJpeg(params: JpegUploadRequest): Promise<{width: number; height: number} | null> {
	const inputPath = temporaryFile({extension: 'jpg'});
	const outputPath = temporaryFile({extension: 'jpg'});

	try {
		await fs.promises.writeFile(inputPath, params.sourceData);

		const orientation = await getJpegOrientation(inputPath);
		const image = sharp(params.sourceData);
		const metadata = await image.metadata();

		const processedBuffer = await image
			.rotate(orientation === 6 ? 90 : 0)
			.jpeg({
				quality: 100,
				chromaSubsampling: '4:2:0',
			})
			.toBuffer();

		await fs.promises.writeFile(outputPath, processedBuffer);
		await stripJpegMetadata(outputPath);

		const finalBuffer = await fs.promises.readFile(outputPath);
		await params.uploadObject({
			bucket: params.destination.bucket,
			key: params.destination.key,
			body: finalBuffer,
			contentType: params.contentType,
		});

		const cleanupErrors = await cleanupTempFiles([inputPath, outputPath]);
		if (cleanupErrors.length > 0) {
			throw new Error(
				`Failed to cleanup temporary files: ${cleanupErrors.map((e) => e.path).join(', ')}. This may indicate disk space or permission issues.`,
			);
		}

		if (metadata.width && metadata.height) {
			return orientation === 6
				? {width: metadata.height, height: metadata.width}
				: {width: metadata.width, height: metadata.height};
		}

		return null;
	} catch (error) {
		const cleanupErrors = await cleanupTempFiles([inputPath, outputPath]);
		if (cleanupErrors.length > 0) {
			Logger.error({cleanupErrors, originalError: error}, 'Failed to cleanup temp files after operation failure');
		}
		throw error;
	}
}

async function cleanupTempFiles(paths: ReadonlyArray<string>): Promise<Array<{path: string; error: unknown}>> {
	const cleanupErrors: Array<{path: string; error: unknown}> = [];
	await Promise.all(
		paths.map((filePath) =>
			fs.promises.unlink(filePath).catch((error) => {
				cleanupErrors.push({path: filePath, error});
			}),
		),
	);
	return cleanupErrors;
}

async function getJpegOrientation(filePath: string): Promise<number> {
	const {stdout} = await execFilePromise('exiftool', ['-Orientation#', '-n', '-j', filePath]);
	try {
		const [{Orientation = 1}] = JSON.parse(stdout);
		return Orientation;
	} catch (error) {
		Logger.error({error, filePath, stdout}, 'Failed to parse exiftool JSON output');
		return 1;
	}
}

async function stripJpegMetadata(filePath: string): Promise<void> {
	await execFilePromise('exiftool', [
		'-all=',
		'-jfif:all=',
		'-JFIFVersion=1.01',
		'-ResolutionUnit=none',
		'-XResolution=1',
		'-YResolution=1',
		'-n',
		'-overwrite_original',
		'-F',
		'-exif:all=',
		'-iptc:all=',
		'-xmp:all=',
		'-icc_profile:all=',
		'-photoshop:all=',
		'-adobe:all=',
		filePath,
	]);
}
