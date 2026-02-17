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

import {createReadStream, createWriteStream, existsSync} from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {S3Error, S3Errors} from '@fluxer/s3/src/errors/S3Error';
import {md5, randomUUID} from '@fluxer/s3/src/utils/Crypto';
import {z} from 'zod';

export interface S3ObjectMetadata {
	key: string;
	size: number;
	lastModified: Date;
	etag: string;
	contentType?: string;
	metadata: Record<string, string>;
}

export interface S3Bucket {
	name: string;
	creationDate: Date;
}

export interface ListObjectsOptions {
	prefix?: string;
	delimiter?: string;
	maxKeys?: number;
	marker?: string;
	startAfter?: string;
	continuationToken?: string;
}

export interface ListObjectsResult {
	isTruncated: boolean;
	contents: Array<S3ObjectMetadata>;
	commonPrefixes: Array<string>;
	nextMarker?: string;
	nextContinuationToken?: string;
	keyCount: number;
}

export interface MultipartUpload {
	uploadId: string;
	bucket: string;
	key: string;
	initiated: Date;
	parts: Map<number, UploadPart>;
}

export interface UploadPart {
	partNumber: number;
	etag: string;
	size: number;
	lastModified: Date;
}

export interface CompletedPart {
	partNumber: number;
	etag: string;
}

export interface S3ServiceConfig {
	root: string;
	buckets: Array<string>;
}

export interface ByteRange {
	start: number;
	end: number;
}

export interface GetObjectOptions {
	range?: ByteRange;
}

export interface GetObjectResult {
	stream: Readable;
	metadata: S3ObjectMetadata;
	contentRange?: string;
}

export interface PutObjectOptions {
	contentType?: string;
	contentMd5?: string;
	metadata?: Record<string, string>;
}

export interface PutObjectResult {
	etag: string;
}

export interface DeleteObjectsResult {
	deleted: Array<string>;
	errors: Array<{key: string; code: string; message: string}>;
}

export interface CopyObjectOptions {
	metadataDirective?: 'COPY' | 'REPLACE';
	metadata?: Record<string, string>;
	contentType?: string;
}

export interface CopyObjectResult {
	etag: string;
	lastModified: Date;
}

export interface CreateMultipartUploadOptions {
	contentType?: string;
	metadata?: Record<string, string>;
}

export interface CreateMultipartUploadResult {
	uploadId: string;
}

export interface UploadPartResult {
	etag: string;
}

export interface CompleteMultipartUploadResult {
	etag: string;
	location: string;
}

export interface ListPartsOptions {
	maxParts?: number;
	partNumberMarker?: number;
}

export interface ListPartsResult {
	parts: Array<UploadPart>;
	isTruncated: boolean;
	nextPartNumberMarker?: number;
}

export interface ListMultipartUploadsOptions {
	prefix?: string;
	maxUploads?: number;
}

export interface ListMultipartUploadsResult {
	uploads: Array<{key: string; uploadId: string; initiated: Date}>;
	isTruncated: boolean;
}

export interface IS3Service {
	initialize(): Promise<void>;
	listBuckets(): Promise<Array<S3Bucket>>;
	createBucket(name: string): Promise<void>;
	deleteBucket(name: string): Promise<void>;
	bucketExists(name: string): Promise<boolean>;
	headBucket(name: string): Promise<void>;
	getObject(bucket: string, key: string, options?: GetObjectOptions): Promise<GetObjectResult>;
	putObject(
		bucket: string,
		key: string,
		body: Readable | Buffer | string,
		options?: PutObjectOptions,
	): Promise<PutObjectResult>;
	deleteObject(bucket: string, key: string): Promise<void>;
	deleteObjects(bucket: string, keys: Array<string>): Promise<DeleteObjectsResult>;
	headObject(bucket: string, key: string): Promise<S3ObjectMetadata>;
	copyObject(
		sourceBucket: string,
		sourceKey: string,
		destBucket: string,
		destKey: string,
		options?: CopyObjectOptions,
	): Promise<CopyObjectResult>;
	listObjects(bucket: string, options?: ListObjectsOptions): Promise<ListObjectsResult>;
	createMultipartUpload(
		bucket: string,
		key: string,
		options?: CreateMultipartUploadOptions,
	): Promise<CreateMultipartUploadResult>;
	uploadPart(
		bucket: string,
		key: string,
		uploadId: string,
		partNumber: number,
		body: Readable | Buffer,
	): Promise<UploadPartResult>;
	completeMultipartUpload(
		bucket: string,
		key: string,
		uploadId: string,
		parts: Array<CompletedPart>,
	): Promise<CompleteMultipartUploadResult>;
	abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void>;
	listParts(bucket: string, key: string, uploadId: string, options?: ListPartsOptions): Promise<ListPartsResult>;
	listMultipartUploads(bucket: string, options?: ListMultipartUploadsOptions): Promise<ListMultipartUploadsResult>;
	clearAll(): Promise<void>;
}

const METADATA_FILE_SUFFIX = '.__s3_meta__';
const MULTIPART_DIR = '__multipart__';

const StoredS3ObjectMetadataSchema = z.object({
	key: z.string(),
	size: z.number(),
	lastModified: z.string(),
	etag: z.string(),
	contentType: z.string().optional(),
	metadata: z.record(z.string(), z.string()).default({}),
});

type StoredS3ObjectMetadata = z.infer<typeof StoredS3ObjectMetadataSchema>;

const MultipartUploadFileSchema = z.object({
	uploadId: z.string(),
	bucket: z.string(),
	key: z.string(),
	initiated: z.string(),
	parts: z.array(z.object({partNumber: z.number(), etag: z.string(), size: z.number()})).default([]),
	contentType: z.string().optional(),
	metadata: z.record(z.string(), z.string()).optional(),
});

type MultipartUploadFile = z.infer<typeof MultipartUploadFileSchema>;

export class S3Service implements IS3Service {
	private readonly root: string;
	private readonly buckets: Array<string>;
	private readonly logger: LoggerInterface;
	private readonly multipartUploads: Map<string, MultipartUpload> = new Map();

	constructor(config: S3ServiceConfig, logger: LoggerInterface) {
		this.root = config.root;
		this.buckets = config.buckets;
		this.logger = logger;
	}

	async initialize(): Promise<void> {
		await this.ensureDirectory(this.root);

		await this.ensureDirectory(path.join(this.root, MULTIPART_DIR));

		for (const bucket of this.buckets) {
			try {
				await this.createBucket(bucket);
				this.logger.info({bucket}, 'Created bucket');
			} catch (error) {
				if (error instanceof S3Error && error.code === 'BucketAlreadyOwnedByYou') {
					this.logger.debug({bucket}, 'Bucket already exists (already owned)');
				} else {
					throw error;
				}
			}
		}
	}

	async listBuckets(): Promise<Array<S3Bucket>> {
		const entries = await fs.readdir(this.root, {withFileTypes: true});
		const buckets: Array<S3Bucket> = [];

		for (const entry of entries) {
			if (entry.isDirectory() && !entry.name.startsWith('__')) {
				const stat = await fs.stat(path.join(this.root, entry.name));
				buckets.push({
					name: entry.name,
					creationDate: stat.birthtime,
				});
			}
		}

		return buckets.sort((a, b) => a.name.localeCompare(b.name));
	}

	async createBucket(name: string): Promise<void> {
		this.validateBucketName(name);

		const bucketPath = this.getBucketPath(name);

		if (existsSync(bucketPath)) {
			throw S3Errors.bucketAlreadyOwnedByYou(name);
		}

		await fs.mkdir(bucketPath, {recursive: true});
		this.logger.info({bucket: name}, 'Bucket created');
	}

	async deleteBucket(name: string): Promise<void> {
		const bucketPath = this.getBucketPath(name);

		if (!existsSync(bucketPath)) {
			throw S3Errors.noSuchBucket(name);
		}

		const entries = await fs.readdir(bucketPath);
		const nonMetaEntries = entries.filter((e) => !e.endsWith(METADATA_FILE_SUFFIX));

		if (nonMetaEntries.length > 0) {
			throw S3Errors.bucketNotEmpty(name);
		}

		for (const entry of entries) {
			await fs.unlink(path.join(bucketPath, entry));
		}

		await fs.rmdir(bucketPath);
		this.logger.info({bucket: name}, 'Bucket deleted');
	}

	async bucketExists(name: string): Promise<boolean> {
		const bucketPath = this.getBucketPath(name);
		try {
			const stat = await fs.stat(bucketPath);
			return stat.isDirectory();
		} catch (error) {
			this.logger.debug({bucket: name, error}, 'Bucket does not exist or cannot be accessed');
			return false;
		}
	}

	async headBucket(name: string): Promise<void> {
		if (!(await this.bucketExists(name))) {
			throw S3Errors.noSuchBucket(name);
		}
	}

	async getObject(bucket: string, key: string, options?: GetObjectOptions): Promise<GetObjectResult> {
		await this.ensureBucketExists(bucket);

		const objectPath = this.getObjectPath(bucket, key);

		if (!existsSync(objectPath)) {
			throw S3Errors.noSuchKey(key);
		}

		const metadata = await this.getObjectMetadata(bucket, key);
		let stream: Readable;
		let contentRange: string | undefined;

		if (options?.range) {
			const {start, end} = options.range;
			const actualEnd = Math.min(end, metadata.size - 1);

			if (start >= metadata.size || start > actualEnd) {
				throw S3Errors.invalidRange();
			}

			stream = createReadStream(objectPath, {start, end: actualEnd});
			contentRange = `bytes ${start}-${actualEnd}/${metadata.size}`;
		} else {
			stream = createReadStream(objectPath);
		}

		return {
			stream,
			metadata,
			...(contentRange !== undefined && {contentRange}),
		};
	}

	async putObject(
		bucket: string,
		key: string,
		body: Readable | Buffer | string,
		options?: PutObjectOptions,
	): Promise<PutObjectResult> {
		await this.ensureBucketExists(bucket);

		const objectPath = this.getObjectPath(bucket, key);
		const metadataPath = this.getMetadataPath(bucket, key);

		await this.ensureDirectory(path.dirname(objectPath));

		let size = 0;
		let hash = '';

		if (Buffer.isBuffer(body) || typeof body === 'string') {
			const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
			size = buffer.length;
			hash = md5(buffer);

			if (options?.contentMd5) {
				const expectedMd5 = Buffer.from(options.contentMd5, 'base64').toString('hex');
				if (expectedMd5 !== hash) {
					throw S3Errors.invalidDigest();
				}
			}

			await fs.writeFile(objectPath, buffer);
		} else {
			const chunks: Array<Buffer> = [];
			const writeStream = createWriteStream(objectPath);

			await pipeline(
				body,
				async function* (source) {
					for await (const chunk of source) {
						const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
						chunks.push(buffer);
						size += buffer.length;
						yield buffer;
					}
				},
				writeStream,
			);

			const fullBuffer = Buffer.concat(chunks);
			hash = md5(fullBuffer);

			if (options?.contentMd5) {
				const expectedMd5 = Buffer.from(options.contentMd5, 'base64').toString('hex');
				if (expectedMd5 !== hash) {
					await fs.unlink(objectPath);
					throw S3Errors.invalidDigest();
				}
			}
		}

		const etag = `"${hash}"`;

		const metadata: S3ObjectMetadata = {
			key,
			size,
			lastModified: new Date(),
			etag,
			contentType: options?.contentType ?? 'application/octet-stream',
			metadata: options?.metadata ?? {},
		};

		await fs.writeFile(metadataPath, JSON.stringify(metadata));

		this.logger.debug({bucket, key, size, etag}, 'Object stored');
		return {etag};
	}

	async deleteObject(bucket: string, key: string): Promise<void> {
		await this.ensureBucketExists(bucket);

		const objectPath = this.getObjectPath(bucket, key);
		const metadataPath = this.getMetadataPath(bucket, key);

		try {
			await fs.unlink(objectPath);
		} catch (error) {
			if (
				typeof error !== 'object' ||
				error === null ||
				!('code' in error) ||
				(error as {code?: string}).code !== 'ENOENT'
			) {
				throw error;
			}
		}

		try {
			await fs.unlink(metadataPath);
		} catch (error) {
			this.logger.debug({bucket, key, error}, 'Failed to delete metadata file (ignoring)');
		}

		this.logger.debug({bucket, key}, 'Object deleted');
	}

	async deleteObjects(bucket: string, keys: Array<string>): Promise<DeleteObjectsResult> {
		await this.ensureBucketExists(bucket);

		const deleted: Array<string> = [];
		const errors: Array<{key: string; code: string; message: string}> = [];

		for (const key of keys) {
			try {
				await this.deleteObject(bucket, key);
				deleted.push(key);
			} catch (error) {
				if (error instanceof S3Error) {
					errors.push({key, code: error.code, message: error.message});
					continue;
				}
				if (error instanceof Error) {
					errors.push({key, code: 'InternalError', message: error.message});
				}
			}
		}

		return {deleted, errors};
	}

	async headObject(bucket: string, key: string): Promise<S3ObjectMetadata> {
		await this.ensureBucketExists(bucket);

		const objectPath = this.getObjectPath(bucket, key);

		if (!existsSync(objectPath)) {
			throw S3Errors.noSuchKey(key);
		}

		return this.getObjectMetadata(bucket, key);
	}

	async copyObject(
		sourceBucket: string,
		sourceKey: string,
		destBucket: string,
		destKey: string,
		options?: CopyObjectOptions,
	): Promise<CopyObjectResult> {
		await this.ensureBucketExists(sourceBucket);
		await this.ensureBucketExists(destBucket);

		const sourcePath = this.getObjectPath(sourceBucket, sourceKey);
		const destPath = this.getObjectPath(destBucket, destKey);
		const destMetadataPath = this.getMetadataPath(destBucket, destKey);

		if (!existsSync(sourcePath)) {
			throw S3Errors.noSuchKey(sourceKey);
		}

		await this.ensureDirectory(path.dirname(destPath));

		await fs.copyFile(sourcePath, destPath);

		let metadata: S3ObjectMetadata;
		const sourceMetadata = await this.getObjectMetadata(sourceBucket, sourceKey);

		if (options?.metadataDirective === 'REPLACE') {
			const stat = await fs.stat(destPath);
			const content = await fs.readFile(destPath);
			const replaceContentType = options.contentType ?? sourceMetadata.contentType;
			metadata = {
				key: destKey,
				size: stat.size,
				lastModified: new Date(),
				etag: `"${md5(content)}"`,
				...(replaceContentType !== undefined && {contentType: replaceContentType}),
				metadata: options.metadata ?? {},
			};
		} else {
			metadata = {
				...sourceMetadata,
				key: destKey,
				lastModified: new Date(),
			};
		}

		await fs.writeFile(destMetadataPath, JSON.stringify(metadata));

		this.logger.debug({sourceBucket, sourceKey, destBucket, destKey}, 'Object copied');

		return {etag: metadata.etag, lastModified: metadata.lastModified};
	}

	async listObjects(bucket: string, options: ListObjectsOptions = {}): Promise<ListObjectsResult> {
		await this.ensureBucketExists(bucket);

		const bucketPath = this.getBucketPath(bucket);
		const maxKeys = options.maxKeys ?? 1000;
		const prefix = options.prefix ?? '';
		const delimiter = options.delimiter;
		const marker = options.marker ?? options.startAfter ?? '';

		const allObjects = await this.listAllObjectsRecursive(bucketPath, '');
		const contents: Array<S3ObjectMetadata> = [];
		const commonPrefixes = new Set<string>();

		for (const obj of allObjects) {
			if (prefix && !obj.key.startsWith(prefix)) {
				continue;
			}

			if (marker && obj.key <= marker) {
				continue;
			}

			if (delimiter) {
				const keyAfterPrefix = obj.key.slice(prefix.length);
				const delimiterIndex = keyAfterPrefix.indexOf(delimiter);

				if (delimiterIndex >= 0) {
					const commonPrefix = prefix + keyAfterPrefix.slice(0, delimiterIndex + 1);
					commonPrefixes.add(commonPrefix);
					continue;
				}
			}

			contents.push(obj);
		}

		contents.sort((a, b) => a.key.localeCompare(b.key));

		const isTruncated = contents.length > maxKeys;
		const truncatedContents = contents.slice(0, maxKeys);
		const nextMarker = isTruncated ? truncatedContents[truncatedContents.length - 1]?.key : undefined;
		const nextContinuationToken = nextMarker ? Buffer.from(nextMarker).toString('base64') : undefined;

		return {
			isTruncated,
			contents: truncatedContents,
			commonPrefixes: Array.from(commonPrefixes).sort(),
			...(nextMarker !== undefined && {nextMarker}),
			...(nextContinuationToken !== undefined && {nextContinuationToken}),
			keyCount: truncatedContents.length,
		};
	}

	async createMultipartUpload(
		bucket: string,
		key: string,
		options?: CreateMultipartUploadOptions,
	): Promise<CreateMultipartUploadResult> {
		await this.ensureBucketExists(bucket);

		const uploadId = randomUUID();
		const uploadDir = this.getMultipartUploadDir(uploadId);

		await fs.mkdir(uploadDir, {recursive: true});

		const upload: MultipartUpload = {
			uploadId,
			bucket,
			key,
			initiated: new Date(),
			parts: new Map(),
		};

		const metadataPath = path.join(uploadDir, 'upload.json');
		await fs.writeFile(
			metadataPath,
			JSON.stringify({
				...upload,
				parts: [],
				contentType: options?.contentType,
				metadata: options?.metadata,
			}),
		);

		this.multipartUploads.set(uploadId, upload);

		this.logger.debug({bucket, key, uploadId}, 'Multipart upload initiated');
		return {uploadId};
	}

	async uploadPart(
		bucket: string,
		key: string,
		uploadId: string,
		partNumber: number,
		body: Readable | Buffer,
	): Promise<UploadPartResult> {
		await this.ensureBucketExists(bucket);

		const uploadDir = this.getMultipartUploadDir(uploadId);
		const metadataPath = path.join(uploadDir, 'upload.json');

		if (!existsSync(metadataPath)) {
			throw S3Errors.noSuchUpload(uploadId);
		}

		const partPath = path.join(uploadDir, `part-${partNumber}`);

		let size = 0;
		let hash = '';

		if (Buffer.isBuffer(body)) {
			size = body.length;
			hash = md5(body);
			await fs.writeFile(partPath, body);
		} else {
			const chunks: Array<Buffer> = [];
			const writeStream = createWriteStream(partPath);

			await pipeline(
				body,
				async function* (source) {
					for await (const chunk of source) {
						const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
						chunks.push(buffer);
						size += buffer.length;
						yield buffer;
					}
				},
				writeStream,
			);

			hash = md5(Buffer.concat(chunks));
		}

		const etag = `"${hash}"`;

		const uploadData = MultipartUploadFileSchema.parse(
			JSON.parse(await fs.readFile(metadataPath, 'utf-8')),
		) satisfies MultipartUploadFile;
		const parts = uploadData.parts;
		const existingIndex = parts.findIndex((p) => p.partNumber === partNumber);

		if (existingIndex >= 0) {
			parts[existingIndex] = {partNumber, etag, size};
		} else {
			parts.push({partNumber, etag, size});
		}

		await fs.writeFile(metadataPath, JSON.stringify({...uploadData, parts}));

		this.logger.debug({bucket, key, uploadId, partNumber, size, etag}, 'Part uploaded');
		return {etag};
	}

	async completeMultipartUpload(
		bucket: string,
		key: string,
		uploadId: string,
		parts: Array<CompletedPart>,
	): Promise<CompleteMultipartUploadResult> {
		await this.ensureBucketExists(bucket);

		const uploadDir = this.getMultipartUploadDir(uploadId);
		const metadataPath = path.join(uploadDir, 'upload.json');

		if (!existsSync(metadataPath)) {
			throw S3Errors.noSuchUpload(uploadId);
		}

		const uploadData = MultipartUploadFileSchema.parse(
			JSON.parse(await fs.readFile(metadataPath, 'utf-8')),
		) satisfies MultipartUploadFile;
		const storedParts = uploadData.parts;

		const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

		for (let i = 0; i < sortedParts.length; i++) {
			if (i > 0 && sortedParts[i]!.partNumber <= sortedParts[i - 1]!.partNumber) {
				throw S3Errors.invalidPartOrder();
			}
		}

		for (const part of sortedParts) {
			const storedPart = storedParts.find((p) => p.partNumber === part.partNumber);
			if (!storedPart) {
				throw S3Errors.invalidPart();
			}
			if (storedPart.etag !== part.etag) {
				throw S3Errors.invalidPart();
			}
		}

		const objectPath = this.getObjectPath(bucket, key);
		await this.ensureDirectory(path.dirname(objectPath));

		const writeStream = createWriteStream(objectPath);
		const etags: Array<string> = [];
		let totalSize = 0;

		for (const part of sortedParts) {
			const partPath = path.join(uploadDir, `part-${part.partNumber}`);
			const partContent = await fs.readFile(partPath);
			writeStream.write(partContent);
			totalSize += partContent.length;
			etags.push(part.etag.replace(/"/g, ''));
		}

		writeStream.end();
		await new Promise<void>((resolve, reject) => {
			writeStream.on('finish', resolve);
			writeStream.on('error', reject);
		});

		const combinedHash = md5(etags.join(''));
		const finalEtag = `"${combinedHash}-${sortedParts.length}"`;

		const objectMetadata: S3ObjectMetadata = {
			key,
			size: totalSize,
			lastModified: new Date(),
			etag: finalEtag,
			contentType: uploadData.contentType ?? 'application/octet-stream',
			metadata: uploadData.metadata ?? {},
		};

		const objectMetadataPath = this.getMetadataPath(bucket, key);
		await fs.writeFile(objectMetadataPath, JSON.stringify(objectMetadata));

		await fs.rm(uploadDir, {recursive: true, force: true});
		this.multipartUploads.delete(uploadId);

		this.logger.debug({bucket, key, uploadId, etag: finalEtag}, 'Multipart upload completed');
		return {etag: finalEtag, location: `/${bucket}/${key}`};
	}

	async abortMultipartUpload(bucket: string, key: string, uploadId: string): Promise<void> {
		await this.ensureBucketExists(bucket);

		const uploadDir = this.getMultipartUploadDir(uploadId);

		if (!existsSync(uploadDir)) {
			throw S3Errors.noSuchUpload(uploadId);
		}

		await fs.rm(uploadDir, {recursive: true, force: true});
		this.multipartUploads.delete(uploadId);

		this.logger.debug({bucket, key, uploadId}, 'Multipart upload aborted');
	}

	async listParts(
		bucket: string,
		_key: string,
		uploadId: string,
		options?: ListPartsOptions,
	): Promise<ListPartsResult> {
		await this.ensureBucketExists(bucket);

		const uploadDir = this.getMultipartUploadDir(uploadId);
		const metadataPath = path.join(uploadDir, 'upload.json');

		if (!existsSync(metadataPath)) {
			throw S3Errors.noSuchUpload(uploadId);
		}

		const uploadData = MultipartUploadFileSchema.parse(
			JSON.parse(await fs.readFile(metadataPath, 'utf-8')),
		) satisfies MultipartUploadFile;
		const storedParts = uploadData.parts.sort((a, b) => a.partNumber - b.partNumber);

		const maxParts = options?.maxParts ?? 1000;
		const partNumberMarker = options?.partNumberMarker ?? 0;

		const filteredParts = storedParts.filter((p) => p.partNumber > partNumberMarker);
		const truncatedParts = filteredParts.slice(0, maxParts);
		const isTruncated = filteredParts.length > maxParts;
		const nextPartNumberMarker = isTruncated ? truncatedParts[truncatedParts.length - 1]?.partNumber : undefined;

		return {
			parts: truncatedParts.map((p) => ({
				...p,
				lastModified: new Date(uploadData.initiated),
			})),
			isTruncated,
			...(nextPartNumberMarker !== undefined && {nextPartNumberMarker}),
		};
	}

	async listMultipartUploads(
		bucket: string,
		options?: ListMultipartUploadsOptions,
	): Promise<ListMultipartUploadsResult> {
		await this.ensureBucketExists(bucket);

		const multipartDir = path.join(this.root, MULTIPART_DIR);
		const maxUploads = options?.maxUploads ?? 1000;
		const prefix = options?.prefix ?? '';

		const uploads: Array<{key: string; uploadId: string; initiated: Date}> = [];

		try {
			const entries = await fs.readdir(multipartDir);

			for (const uploadId of entries) {
				const metadataPath = path.join(multipartDir, uploadId, 'upload.json');
				if (existsSync(metadataPath)) {
					const uploadData = MultipartUploadFileSchema.parse(
						JSON.parse(await fs.readFile(metadataPath, 'utf-8')),
					) satisfies MultipartUploadFile;
					if (uploadData.bucket === bucket && uploadData.key.startsWith(prefix)) {
						uploads.push({
							key: uploadData.key,
							uploadId,
							initiated: new Date(uploadData.initiated),
						});
					}
				}
			}
		} catch (error) {
			this.logger.debug({bucket, error}, 'Failed to read multipart directory (returning empty list)');
		}

		const sortedUploads = uploads.sort((a, b) => a.key.localeCompare(b.key));
		const isTruncated = sortedUploads.length > maxUploads;

		return {
			uploads: sortedUploads.slice(0, maxUploads),
			isTruncated,
		};
	}

	private validateBucketName(name: string): void {
		if (name.length < 3 || name.length > 63) {
			throw S3Errors.invalidBucketName(name);
		}

		if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(name)) {
			throw S3Errors.invalidBucketName(name);
		}

		if (/\.\./.test(name) || /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(name)) {
			throw S3Errors.invalidBucketName(name);
		}
	}

	private getBucketPath(bucket: string): string {
		if (bucket.includes('..') || bucket.includes('/') || bucket.includes('\\')) {
			throw S3Errors.invalidBucketName(bucket);
		}
		return path.join(this.root, bucket);
	}

	private getObjectPath(bucket: string, key: string): string {
		this.validateKey(key);
		const bucketPath = this.getBucketPath(bucket);
		const objectPath = path.join(bucketPath, key);

		// SECURITY: Ensure resolved path is within bucket directory (prevents path traversal)
		const resolvedPath = path.resolve(objectPath);
		const resolvedBucketPath = path.resolve(bucketPath);
		if (!resolvedPath.startsWith(resolvedBucketPath + path.sep) && resolvedPath !== resolvedBucketPath) {
			throw S3Errors.invalidArgument('Invalid key: path traversal detected');
		}

		return objectPath;
	}

	private getMetadataPath(bucket: string, key: string): string {
		this.validateKey(key);
		const bucketPath = this.getBucketPath(bucket);
		const metadataPath = path.join(bucketPath, `${key}${METADATA_FILE_SUFFIX}`);

		// SECURITY: Ensure resolved path is within bucket directory
		const resolvedPath = path.resolve(metadataPath);
		const resolvedBucketPath = path.resolve(bucketPath);
		if (!resolvedPath.startsWith(resolvedBucketPath + path.sep)) {
			throw S3Errors.invalidArgument('Invalid key: path traversal detected');
		}

		return metadataPath;
	}

	private getMultipartUploadDir(uploadId: string): string {
		// SECURITY: Validate uploadId doesn't contain path traversal
		if (uploadId.includes('..') || uploadId.includes('/') || uploadId.includes('\\')) {
			throw S3Errors.invalidArgument('Invalid uploadId');
		}
		return path.join(this.root, MULTIPART_DIR, uploadId);
	}

	private validateKey(key: string): void {
		if (!key || key.length === 0) {
			throw S3Errors.invalidArgument('Key cannot be empty');
		}
		if (key.length > 1024) {
			throw S3Errors.invalidArgument('Key too long (max 1024 characters)');
		}
		if (key.includes('\0')) {
			throw S3Errors.invalidArgument('Key cannot contain null bytes');
		}
	}

	private async ensureDirectory(dir: string): Promise<void> {
		await fs.mkdir(dir, {recursive: true});
	}

	async clearAll(): Promise<void> {
		for (const bucket of this.buckets) {
			const bucketPath = this.getBucketPath(bucket);
			await fs.rm(bucketPath, {recursive: true, force: true});
			await fs.mkdir(bucketPath, {recursive: true});
		}

		const multipartDir = path.join(this.root, MULTIPART_DIR);
		await fs.rm(multipartDir, {recursive: true, force: true});
		await fs.mkdir(multipartDir, {recursive: true});
	}

	private async ensureBucketExists(bucket: string): Promise<void> {
		if (!(await this.bucketExists(bucket))) {
			throw S3Errors.noSuchBucket(bucket);
		}
	}

	private async getObjectMetadata(bucket: string, key: string): Promise<S3ObjectMetadata> {
		const metadataPath = this.getMetadataPath(bucket, key);
		const objectPath = this.getObjectPath(bucket, key);

		try {
			const metadataStr = await fs.readFile(metadataPath, 'utf-8');
			const parsed = StoredS3ObjectMetadataSchema.parse(JSON.parse(metadataStr)) satisfies StoredS3ObjectMetadata;
			return {
				key: parsed.key,
				size: parsed.size,
				etag: parsed.etag,
				metadata: parsed.metadata,
				lastModified: new Date(parsed.lastModified),
				...(parsed.contentType !== undefined && {contentType: parsed.contentType}),
			};
		} catch (error) {
			this.logger.debug({bucket, key, error}, 'Failed to read metadata file, generating from object');
			const stat = await fs.stat(objectPath);
			const content = await fs.readFile(objectPath);
			const metadata: S3ObjectMetadata = {
				key,
				size: stat.size,
				lastModified: stat.mtime,
				etag: `"${md5(content)}"`,
				contentType: 'application/octet-stream',
				metadata: {},
			};
			return metadata;
		}
	}

	private async listAllObjectsRecursive(basePath: string, prefix: string): Promise<Array<S3ObjectMetadata>> {
		const results: Array<S3ObjectMetadata> = [];
		const currentPath = path.join(basePath, prefix);

		try {
			const entries = await fs.readdir(currentPath, {withFileTypes: true});

			for (const entry of entries) {
				const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;

				if (entry.isDirectory()) {
					const subResults = await this.listAllObjectsRecursive(basePath, entryPath);
					results.push(...subResults);
				} else if (!entry.name.endsWith(METADATA_FILE_SUFFIX)) {
					const fullPath = path.join(basePath, entryPath);
					const stat = await fs.stat(fullPath);
					const metadataPath = `${fullPath}${METADATA_FILE_SUFFIX}`;

					let metadata: S3ObjectMetadata;
					try {
						const metadataStr = await fs.readFile(metadataPath, 'utf-8');
						const parsed = StoredS3ObjectMetadataSchema.parse(JSON.parse(metadataStr)) satisfies StoredS3ObjectMetadata;
						metadata = {
							key: parsed.key,
							size: parsed.size,
							etag: parsed.etag,
							metadata: parsed.metadata,
							lastModified: new Date(parsed.lastModified),
							...(parsed.contentType !== undefined && {contentType: parsed.contentType}),
						};
					} catch (error) {
						this.logger.debug({key: entryPath, error}, 'Failed to read metadata file, generating from object');
						const content = await fs.readFile(fullPath);
						metadata = {
							key: entryPath,
							size: stat.size,
							lastModified: stat.mtime,
							etag: `"${md5(content)}"`,
							contentType: 'application/octet-stream',
							metadata: {},
						};
					}

					results.push({...metadata, key: entryPath});
				}
			}
		} catch (error) {
			this.logger.debug({basePath, prefix, error}, 'Failed to list directory in recursive scan');
		}

		return results;
	}
}
