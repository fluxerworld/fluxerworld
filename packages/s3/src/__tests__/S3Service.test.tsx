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

import * as fs from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createMockLogger} from '@fluxer/logger/src/mock';
import {S3Error} from '@fluxer/s3/src/errors/S3Error';
import {S3Service} from '@fluxer/s3/src/s3/S3Service';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

const testRoot = `/tmp/fluxer-s3-service-test-${Date.now()}`;
const mockLogger = createMockLogger();

async function streamToString(stream: Readable): Promise<string> {
	return new Response(Readable.toWeb(stream) as ReadableStream).text();
}

beforeEach(async () => {
	await fs.rm(testRoot, {recursive: true, force: true});
});

afterEach(async () => {
	await fs.rm(testRoot, {recursive: true, force: true});
});

describe('S3Service', () => {
	describe('initialize', () => {
		it('should create root directory and specified buckets', async () => {
			const service = new S3Service({root: testRoot, buckets: ['bucket1', 'bucket2']}, mockLogger);
			await service.initialize();

			const buckets = await service.listBuckets();
			expect(buckets.map((b) => b.name).sort()).toEqual(['bucket1', 'bucket2']);
		});

		it('should handle already existing buckets during initialization', async () => {
			const service = new S3Service({root: testRoot, buckets: ['existing-bucket']}, mockLogger);
			await service.initialize();
			await service.initialize();

			const buckets = await service.listBuckets();
			expect(buckets).toHaveLength(1);
		});
	});

	describe('bucket operations', () => {
		it('should create and list buckets', async () => {
			const service = new S3Service({root: testRoot, buckets: []}, mockLogger);
			await service.initialize();

			await service.createBucket('test-bucket');
			const buckets = await service.listBuckets();

			expect(buckets).toHaveLength(1);
			expect(buckets[0].name).toBe('test-bucket');
		});

		it('should throw error when creating duplicate bucket', async () => {
			const service = new S3Service({root: testRoot, buckets: []}, mockLogger);
			await service.initialize();

			await service.createBucket('test-bucket');
			await expect(service.createBucket('test-bucket')).rejects.toThrow(S3Error);
		});

		it('should delete empty bucket', async () => {
			const service = new S3Service({root: testRoot, buckets: ['delete-me']}, mockLogger);
			await service.initialize();

			await service.deleteBucket('delete-me');
			const buckets = await service.listBuckets();

			expect(buckets).toHaveLength(0);
		});

		it('should throw error when deleting non-existent bucket', async () => {
			const service = new S3Service({root: testRoot, buckets: []}, mockLogger);
			await service.initialize();

			await expect(service.deleteBucket('nonexistent')).rejects.toThrow(S3Error);
		});

		it('should throw error when deleting non-empty bucket', async () => {
			const service = new S3Service({root: testRoot, buckets: ['non-empty']}, mockLogger);
			await service.initialize();

			await service.putObject('non-empty', 'file.txt', Buffer.from('content'), {});

			await expect(service.deleteBucket('non-empty')).rejects.toThrow(S3Error);
		});

		it('should check bucket existence', async () => {
			const service = new S3Service({root: testRoot, buckets: ['exists']}, mockLogger);
			await service.initialize();

			expect(await service.bucketExists('exists')).toBe(true);
			expect(await service.bucketExists('not-exists')).toBe(false);
		});

		it('should head bucket successfully', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await expect(service.headBucket('test-bucket')).resolves.toBeUndefined();
		});

		it('should throw error when heading non-existent bucket', async () => {
			const service = new S3Service({root: testRoot, buckets: []}, mockLogger);
			await service.initialize();

			await expect(service.headBucket('nonexistent')).rejects.toThrow(S3Error);
		});
	});

	describe('object operations', () => {
		it('should put and get object', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const content = Buffer.from('Hello, World!');
			await service.putObject('test-bucket', 'hello.txt', content, {
				contentType: 'text/plain',
			});

			const result = await service.getObject('test-bucket', 'hello.txt');
			const data = await streamToString(result.stream);

			expect(data).toBe('Hello, World!');
			expect(result.metadata.contentType).toBe('text/plain');
			expect(result.metadata.size).toBe(content.length);
		});

		it('should throw error when getting non-existent object', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await expect(service.getObject('test-bucket', 'nonexistent.txt')).rejects.toThrow(S3Error);
		});

		it('should throw error when getting object from non-existent bucket', async () => {
			const service = new S3Service({root: testRoot, buckets: []}, mockLogger);
			await service.initialize();

			await expect(service.getObject('nonexistent', 'file.txt')).rejects.toThrow(S3Error);
		});

		it('should get object with range', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const content = Buffer.from('Hello, World!');
			await service.putObject('test-bucket', 'range.txt', content, {});

			const result = await service.getObject('test-bucket', 'range.txt', {
				range: {start: 0, end: 4},
			});
			const data = await streamToString(result.stream);

			expect(data).toBe('Hello');
			expect(result.contentRange).toBe('bytes 0-4/13');
		});

		it('should throw error for invalid range', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const content = Buffer.from('Short');
			await service.putObject('test-bucket', 'short.txt', content, {});

			await expect(
				service.getObject('test-bucket', 'short.txt', {
					range: {start: 100, end: 200},
				}),
			).rejects.toThrow(S3Error);
		});

		it('should delete object', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await service.putObject('test-bucket', 'to-delete.txt', Buffer.from('delete me'), {});
			await service.deleteObject('test-bucket', 'to-delete.txt');

			await expect(service.getObject('test-bucket', 'to-delete.txt')).rejects.toThrow(S3Error);
		});

		it('should delete multiple objects', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await service.putObject('test-bucket', 'file1.txt', Buffer.from('1'), {});
			await service.putObject('test-bucket', 'file2.txt', Buffer.from('2'), {});
			await service.putObject('test-bucket', 'file3.txt', Buffer.from('3'), {});

			const result = await service.deleteObjects('test-bucket', ['file1.txt', 'file2.txt', 'nonexistent.txt']);

			expect(result.deleted).toContain('file1.txt');
			expect(result.deleted).toContain('file2.txt');
			expect(result.deleted).toContain('nonexistent.txt');
			expect(result.errors).toHaveLength(0);
		});

		it('should head object', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const content = Buffer.from('Hello!');
			await service.putObject('test-bucket', 'head-me.txt', content, {
				contentType: 'text/plain',
			});

			const metadata = await service.headObject('test-bucket', 'head-me.txt');

			expect(metadata.size).toBe(content.length);
			expect(metadata.contentType).toBe('text/plain');
			expect(metadata.key).toBe('head-me.txt');
		});

		it('should throw error when heading non-existent object', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await expect(service.headObject('test-bucket', 'nonexistent.txt')).rejects.toThrow(S3Error);
		});

		it('should put object with user metadata', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await service.putObject('test-bucket', 'with-meta.txt', Buffer.from('data'), {
				metadata: {
					'x-amz-meta-author': 'test-user',
					'x-amz-meta-version': '1.0',
				},
			});

			const metadata = await service.headObject('test-bucket', 'with-meta.txt');
			expect(metadata.metadata['x-amz-meta-author']).toBe('test-user');
			expect(metadata.metadata['x-amz-meta-version']).toBe('1.0');
		});
	});

	describe('list objects', () => {
		it('should list objects in bucket', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await service.putObject('test-bucket', 'file1.txt', Buffer.from('1'), {});
			await service.putObject('test-bucket', 'file2.txt', Buffer.from('2'), {});
			await service.putObject('test-bucket', 'folder/file3.txt', Buffer.from('3'), {});

			const result = await service.listObjects('test-bucket', {});

			expect(result.contents).toHaveLength(3);
			expect(result.keyCount).toBe(3);
		});

		it('should list objects with prefix', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await service.putObject('test-bucket', 'prefix-a/file1.txt', Buffer.from('1'), {});
			await service.putObject('test-bucket', 'prefix-a/file2.txt', Buffer.from('2'), {});
			await service.putObject('test-bucket', 'prefix-b/file3.txt', Buffer.from('3'), {});

			const result = await service.listObjects('test-bucket', {prefix: 'prefix-a/'});

			expect(result.contents).toHaveLength(2);
			expect(result.contents.every((o) => o.key.startsWith('prefix-a/'))).toBe(true);
		});

		it('should list objects with delimiter', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await service.putObject('test-bucket', 'folder1/file1.txt', Buffer.from('1'), {});
			await service.putObject('test-bucket', 'folder2/file2.txt', Buffer.from('2'), {});
			await service.putObject('test-bucket', 'root.txt', Buffer.from('3'), {});

			const result = await service.listObjects('test-bucket', {delimiter: '/'});

			expect(result.contents.some((o) => o.key === 'root.txt')).toBe(true);
			expect(result.commonPrefixes).toContain('folder1/');
			expect(result.commonPrefixes).toContain('folder2/');
		});

		it('should paginate with maxKeys', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			for (let i = 0; i < 5; i++) {
				await service.putObject('test-bucket', `file${i}.txt`, Buffer.from(`${i}`), {});
			}

			const result = await service.listObjects('test-bucket', {maxKeys: 2});

			expect(result.contents).toHaveLength(2);
			expect(result.isTruncated).toBe(true);
		});

		it('should continue from marker', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await service.putObject('test-bucket', 'a.txt', Buffer.from('a'), {});
			await service.putObject('test-bucket', 'b.txt', Buffer.from('b'), {});
			await service.putObject('test-bucket', 'c.txt', Buffer.from('c'), {});

			const result = await service.listObjects('test-bucket', {marker: 'a.txt'});

			expect(result.contents.some((o) => o.key === 'a.txt')).toBe(false);
			expect(result.contents.some((o) => o.key === 'b.txt')).toBe(true);
		});
	});

	describe('copy object', () => {
		it('should copy object within same bucket', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const content = Buffer.from('Original content');
			await service.putObject('test-bucket', 'source.txt', content, {
				contentType: 'text/plain',
			});

			await service.copyObject('test-bucket', 'source.txt', 'test-bucket', 'destination.txt');

			const result = await service.getObject('test-bucket', 'destination.txt');
			const data = await streamToString(result.stream);

			expect(data).toBe('Original content');
		});

		it('should copy object between buckets', async () => {
			const service = new S3Service({root: testRoot, buckets: ['source-bucket', 'dest-bucket']}, mockLogger);
			await service.initialize();

			await service.putObject('source-bucket', 'file.txt', Buffer.from('cross-bucket'), {});

			await service.copyObject('source-bucket', 'file.txt', 'dest-bucket', 'copied.txt');

			const result = await service.getObject('dest-bucket', 'copied.txt');
			const data = await streamToString(result.stream);

			expect(data).toBe('cross-bucket');
		});

		it('should throw error when copying non-existent source', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await expect(
				service.copyObject('test-bucket', 'nonexistent.txt', 'test-bucket', 'destination.txt'),
			).rejects.toThrow(S3Error);
		});
	});

	describe('multipart upload', () => {
		it('should create multipart upload', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const result = await service.createMultipartUpload('test-bucket', 'large-file.bin', {
				contentType: 'application/octet-stream',
			});

			expect(result.uploadId).toBeTruthy();
		});

		it('should upload part', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const upload = await service.createMultipartUpload('test-bucket', 'large-file.bin', {});
			const partData = Buffer.from('part data content');

			const part = await service.uploadPart('test-bucket', 'large-file.bin', upload.uploadId, 1, partData);

			expect(part.etag).toBeTruthy();
		});

		it('should complete multipart upload', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const upload = await service.createMultipartUpload('test-bucket', 'multi.bin', {});

			const part1 = await service.uploadPart('test-bucket', 'multi.bin', upload.uploadId, 1, Buffer.from('part1'));
			const part2 = await service.uploadPart('test-bucket', 'multi.bin', upload.uploadId, 2, Buffer.from('part2'));

			const result = await service.completeMultipartUpload('test-bucket', 'multi.bin', upload.uploadId, [
				{partNumber: 1, etag: part1.etag},
				{partNumber: 2, etag: part2.etag},
			]);

			expect(result.etag).toBeTruthy();
			expect(result.location).toContain('multi.bin');

			const obj = await service.getObject('test-bucket', 'multi.bin');
			const data = await streamToString(obj.stream);
			expect(data).toBe('part1part2');
		});

		it('should abort multipart upload', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const upload = await service.createMultipartUpload('test-bucket', 'abort-me.bin', {});
			await service.uploadPart('test-bucket', 'abort-me.bin', upload.uploadId, 1, Buffer.from('data'));

			await service.abortMultipartUpload('test-bucket', 'abort-me.bin', upload.uploadId);

			await expect(service.getObject('test-bucket', 'abort-me.bin')).rejects.toThrow(S3Error);
		});

		it('should list parts', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			const upload = await service.createMultipartUpload('test-bucket', 'parts.bin', {});
			await service.uploadPart('test-bucket', 'parts.bin', upload.uploadId, 1, Buffer.from('part1'));
			await service.uploadPart('test-bucket', 'parts.bin', upload.uploadId, 2, Buffer.from('part2'));

			const result = await service.listParts('test-bucket', 'parts.bin', upload.uploadId, {});

			expect(result.parts).toHaveLength(2);
			expect(result.parts.some((p) => p.partNumber === 1)).toBe(true);
			expect(result.parts.some((p) => p.partNumber === 2)).toBe(true);
		});

		it('should list multipart uploads', async () => {
			const service = new S3Service({root: testRoot, buckets: ['test-bucket']}, mockLogger);
			await service.initialize();

			await service.createMultipartUpload('test-bucket', 'upload1.bin', {});
			await service.createMultipartUpload('test-bucket', 'upload2.bin', {});

			const result = await service.listMultipartUploads('test-bucket', {});

			expect(result.uploads).toHaveLength(2);
		});
	});

	describe('bucket name validation', () => {
		it('should reject bucket names shorter than 3 characters', async () => {
			const service = new S3Service({root: testRoot, buckets: []}, mockLogger);
			await service.initialize();

			await expect(service.createBucket('ab')).rejects.toThrow(S3Error);
		});

		it('should reject bucket names longer than 63 characters', async () => {
			const service = new S3Service({root: testRoot, buckets: []}, mockLogger);
			await service.initialize();

			const longName = 'a'.repeat(64);
			await expect(service.createBucket(longName)).rejects.toThrow(S3Error);
		});

		it('should reject bucket names with invalid characters', async () => {
			const service = new S3Service({root: testRoot, buckets: []}, mockLogger);
			await service.initialize();

			await expect(service.createBucket('UPPERCASE')).rejects.toThrow(S3Error);
			await expect(service.createBucket('under_score')).rejects.toThrow(S3Error);
		});
	});
});
