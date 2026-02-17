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
import {createMockLogger} from '@fluxer/logger/src/mock';
import {createS3App} from '@fluxer/s3/src/App';
import {hmacSha256, sha256} from '@fluxer/s3/src/utils/Crypto';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

const testRoot = `/tmp/fluxer-s3-controllers-test-${Date.now()}`;
const mockLogger = createMockLogger();

const TEST_ACCESS_KEY = 'test-access-key';
const TEST_SECRET_KEY = 'test-secret-key';
const TEST_REGION = 'us-east-1';
const TEST_HOST = 'localhost';

const authConfig = {
	accessKey: TEST_ACCESS_KEY,
	secretKey: TEST_SECRET_KEY,
};

interface SignedRequestOptions {
	method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD';
	path: string;
	body?: string | Buffer;
	contentType?: string;
	headers?: Record<string, string>;
}

function generateSignedRequest(options: SignedRequestOptions): {url: string; headers: Record<string, string>} {
	const {method, path, body, contentType, headers: extraHeaders = {}} = options;

	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d+/g, '');
	const dateStamp = amzDate.slice(0, 8);

	const service = 's3';
	const algorithm = 'AWS4-HMAC-SHA256';
	const credentialScope = `${dateStamp}/${TEST_REGION}/${service}/aws4_request`;

	const payloadHash = body ? sha256(typeof body === 'string' ? body : body.toString()) : sha256('');

	const allHeaders: Record<string, string> = {
		host: TEST_HOST,
		'x-amz-date': amzDate,
		'x-amz-content-sha256': payloadHash,
		...extraHeaders,
	};

	if (contentType) {
		allHeaders['content-type'] = contentType;
	}

	const signedHeadersList = Object.keys(allHeaders)
		.map((k) => k.toLowerCase())
		.sort();
	const signedHeadersString = signedHeadersList.join(';');

	const canonicalHeaders = signedHeadersList.map((key) => `${key}:${allHeaders[key]!.trim()}\n`).join('');

	const canonicalUri = path.split('?')[0]!;
	const queryString = path.includes('?') ? path.split('?')[1]! : '';

	const queryParams = new URLSearchParams(queryString);
	const sortedQueryKeys = Array.from(queryParams.keys()).sort();
	const canonicalQueryString = sortedQueryKeys
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams.get(key)!)}`)
		.join('&');

	const canonicalRequest = [
		method,
		canonicalUri,
		canonicalQueryString,
		canonicalHeaders,
		signedHeadersString,
		payloadHash,
	].join('\n');

	const stringToSign = [algorithm, amzDate, credentialScope, sha256(canonicalRequest)].join('\n');

	const kDate = hmacSha256(`AWS4${TEST_SECRET_KEY}`, dateStamp);
	const kRegion = hmacSha256(kDate, TEST_REGION);
	const kService = hmacSha256(kRegion, service);
	const kSigning = hmacSha256(kService, 'aws4_request');
	const signature = hmacSha256(kSigning, stringToSign).toString('hex');

	const authorizationHeader = `${algorithm} Credential=${TEST_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeadersString}, Signature=${signature}`;

	return {
		url: `http://${TEST_HOST}${path}`,
		headers: {
			...allHeaders,
			authorization: authorizationHeader,
		},
	};
}

beforeEach(async () => {
	await fs.rm(testRoot, {recursive: true, force: true});
});

afterEach(async () => {
	await fs.rm(testRoot, {recursive: true, force: true});
});

describe('BucketController', () => {
	describe('GET / - list buckets', () => {
		it('should list all buckets', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['bucket-a', 'bucket-b']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<ListAllMyBucketsResult');
			expect(xml).toContain('<Name>bucket-a</Name>');
			expect(xml).toContain('<Name>bucket-b</Name>');
		});

		it('should return empty buckets list when no buckets exist', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<Buckets>');
			expect(xml).toContain('</Buckets>');
		});
	});

	describe('PUT /:bucket - create bucket', () => {
		it('should create a new bucket', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/new-bucket',
			});

			const res = await app.request(url, {method: 'PUT', headers});

			expect(res.status).toBe(200);
			expect(res.headers.get('Location')).toBe('/new-bucket');

			const buckets = await getS3Service().listBuckets();
			expect(buckets.some((b) => b.name === 'new-bucket')).toBe(true);
		});

		it('should return error for duplicate bucket', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['existing-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/existing-bucket',
			});

			const res = await app.request(url, {method: 'PUT', headers});

			expect(res.status).toBe(409);
			const xml = await res.text();
			expect(xml).toContain('<Code>BucketAlreadyOwnedByYou</Code>');
		});

		it('should return error for invalid bucket name', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/ab',
			});

			const res = await app.request(url, {method: 'PUT', headers});

			expect(res.status).toBe(400);
			const xml = await res.text();
			expect(xml).toContain('<Code>InvalidBucketName</Code>');
		});
	});

	describe('DELETE /:bucket - delete bucket', () => {
		it('should delete an empty bucket', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['delete-me']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'DELETE',
				path: '/delete-me',
			});

			const res = await app.request(url, {method: 'DELETE', headers});

			expect(res.status).toBe(204);

			const buckets = await getS3Service().listBuckets();
			expect(buckets.some((b) => b.name === 'delete-me')).toBe(false);
		});

		it('should return error for non-empty bucket', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['non-empty']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('non-empty', 'file.txt', Buffer.from('content'), {});

			const {url, headers} = generateSignedRequest({
				method: 'DELETE',
				path: '/non-empty',
			});

			const res = await app.request(url, {method: 'DELETE', headers});

			expect(res.status).toBe(409);
			const xml = await res.text();
			expect(xml).toContain('<Code>BucketNotEmpty</Code>');
		});

		it('should return error for non-existent bucket', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'DELETE',
				path: '/nonexistent',
			});

			const res = await app.request(url, {method: 'DELETE', headers});

			expect(res.status).toBe(404);
			const xml = await res.text();
			expect(xml).toContain('<Code>NoSuchBucket</Code>');
		});
	});

	describe('GET /:bucket - list objects', () => {
		it('should list objects in bucket', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'file1.txt', Buffer.from('content1'), {});
			await getS3Service().putObject('test-bucket', 'file2.txt', Buffer.from('content2'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<ListBucketResult');
			expect(xml).toContain('<Key>file1.txt</Key>');
			expect(xml).toContain('<Key>file2.txt</Key>');
		});

		it('should list objects with prefix', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'prefix-a/file1.txt', Buffer.from('1'), {});
			await getS3Service().putObject('test-bucket', 'prefix-a/file2.txt', Buffer.from('2'), {});
			await getS3Service().putObject('test-bucket', 'prefix-b/file3.txt', Buffer.from('3'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?prefix=prefix-a/',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<Key>prefix-a/file1.txt</Key>');
			expect(xml).toContain('<Key>prefix-a/file2.txt</Key>');
			expect(xml).not.toContain('<Key>prefix-b/file3.txt</Key>');
		});

		it('should list objects with delimiter', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'folder1/file1.txt', Buffer.from('1'), {});
			await getS3Service().putObject('test-bucket', 'folder2/file2.txt', Buffer.from('2'), {});
			await getS3Service().putObject('test-bucket', 'root.txt', Buffer.from('3'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?delimiter=/',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<Key>root.txt</Key>');
			expect(xml).toContain('<CommonPrefixes>');
			expect(xml).toContain('<Prefix>folder1/</Prefix>');
			expect(xml).toContain('<Prefix>folder2/</Prefix>');
		});

		it('should list objects with list-type 2', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'file.txt', Buffer.from('content'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?list-type=2',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<ListBucketResult');
			expect(xml).toContain('<KeyCount>');
		});

		it('should return bucket location', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?location',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<LocationConstraint');
		});

		it('should return bucket versioning', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?versioning',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<VersioningConfiguration');
		});

		it('should return bucket ACL', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?acl',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<AccessControlPolicy');
			expect(xml).toContain('<Permission>FULL_CONTROL</Permission>');
		});

		it('should return bucket CORS', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?cors',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<CORSConfiguration');
		});

		it('should list multipart uploads', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().createMultipartUpload('test-bucket', 'upload.bin', {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?uploads',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<ListMultipartUploadsResult');
			expect(xml).toContain('<Key>upload.bin</Key>');
		});

		it('should return error for non-existent bucket', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/nonexistent',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(404);
			const xml = await res.text();
			expect(xml).toContain('<Code>NoSuchBucket</Code>');
		});
	});
});

describe('ObjectController', () => {
	describe('PUT /:bucket/:key - put object', () => {
		it('should put an object', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const content = 'Hello, World!';
			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/test-bucket/hello.txt',
				body: content,
				contentType: 'text/plain',
			});

			const res = await app.request(url, {method: 'PUT', headers, body: content});

			expect(res.status).toBe(200);
			expect(res.headers.get('ETag')).toBeTruthy();

			const metadata = await getS3Service().headObject('test-bucket', 'hello.txt');
			expect(metadata.size).toBe(content.length);
		});

		it('should put an object with nested key', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const content = 'Nested content';
			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/test-bucket/folder/subfolder/file.txt',
				body: content,
				contentType: 'text/plain',
			});

			const res = await app.request(url, {method: 'PUT', headers, body: content});

			expect(res.status).toBe(200);

			const metadata = await getS3Service().headObject('test-bucket', 'folder/subfolder/file.txt');
			expect(metadata.key).toBe('folder/subfolder/file.txt');
		});

		it('should put object with user metadata', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const content = 'With metadata';
			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/test-bucket/meta.txt',
				body: content,
				contentType: 'text/plain',
				headers: {
					'x-amz-meta-author': 'test-user',
					'x-amz-meta-version': '1.0',
				},
			});

			const res = await app.request(url, {method: 'PUT', headers, body: content});

			expect(res.status).toBe(200);

			const metadata = await getS3Service().headObject('test-bucket', 'meta.txt');
			expect(metadata.metadata['author']).toBe('test-user');
			expect(metadata.metadata['version']).toBe('1.0');
		});

		it('should return error when putting to non-existent bucket', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: []},
				authConfig,
			});
			await initialize();

			const content = 'content';
			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/nonexistent/file.txt',
				body: content,
			});

			const res = await app.request(url, {method: 'PUT', headers, body: content});

			expect(res.status).toBe(404);
			const xml = await res.text();
			expect(xml).toContain('<Code>NoSuchBucket</Code>');
		});
	});

	describe('PUT /:bucket/:key - copy object', () => {
		it('should copy an object', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'source.txt', Buffer.from('Original'), {});

			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/test-bucket/destination.txt',
				body: '',
				headers: {
					'x-amz-copy-source': '/test-bucket/source.txt',
				},
			});

			const res = await app.request(url, {method: 'PUT', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<CopyObjectResult>');
			expect(xml).toContain('<ETag>');

			const metadata = await getS3Service().headObject('test-bucket', 'destination.txt');
			expect(metadata.size).toBe(8);
		});

		it('should copy object with metadata replace', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'source.txt', Buffer.from('content'), {
				metadata: {'original-meta': 'value'},
			});

			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/test-bucket/destination.txt',
				body: '',
				contentType: 'text/plain',
				headers: {
					'x-amz-copy-source': '/test-bucket/source.txt',
					'x-amz-metadata-directive': 'REPLACE',
					'x-amz-meta-new-meta': 'new-value',
				},
			});

			const res = await app.request(url, {method: 'PUT', headers});

			expect(res.status).toBe(200);

			const metadata = await getS3Service().headObject('test-bucket', 'destination.txt');
			expect(metadata.metadata['new-meta']).toBe('new-value');
		});
	});

	describe('GET /:bucket/:key - get object', () => {
		it('should get an object', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'hello.txt', Buffer.from('Hello, World!'), {
				contentType: 'text/plain',
			});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/hello.txt',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			expect(res.headers.get('Content-Type')).toBe('text/plain');
			expect(res.headers.get('ETag')).toBeTruthy();
			const body = await res.text();
			expect(body).toBe('Hello, World!');
		});

		it('should get object with range', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'range.txt', Buffer.from('Hello, World!'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/range.txt',
				headers: {
					range: 'bytes=0-4',
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(206);
			expect(res.headers.get('Content-Range')).toBe('bytes 0-4/13');
			const body = await res.text();
			expect(body).toBe('Hello');
		});

		it('should return 304 for if-none-match', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const result = await getS3Service().putObject('test-bucket', 'etag.txt', Buffer.from('content'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/etag.txt',
				headers: {
					'if-none-match': result.etag,
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(304);
		});

		it('should return object ACL', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'acl.txt', Buffer.from('content'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/acl.txt?acl',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<AccessControlPolicy');
			expect(xml).toContain('<Permission>FULL_CONTROL</Permission>');
		});

		it('should return error for non-existent object', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/nonexistent.txt',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(404);
			const xml = await res.text();
			expect(xml).toContain('<Code>NoSuchKey</Code>');
		});

		it('should handle if-match precondition', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'match.txt', Buffer.from('content'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/match.txt',
				headers: {
					'if-match': '"wrong-etag"',
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(412);
			const xml = await res.text();
			expect(xml).toContain('<Code>PreconditionFailed</Code>');
		});
	});

	describe('DELETE /:bucket/:key - delete object', () => {
		it('should delete an object', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'delete-me.txt', Buffer.from('content'), {});

			const {url, headers} = generateSignedRequest({
				method: 'DELETE',
				path: '/test-bucket/delete-me.txt',
			});

			const res = await app.request(url, {method: 'DELETE', headers});

			expect(res.status).toBe(204);

			const exists = await getS3Service().bucketExists('test-bucket');
			expect(exists).toBe(true);
		});

		it('should return 204 for non-existent object', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'DELETE',
				path: '/test-bucket/nonexistent.txt',
			});

			const res = await app.request(url, {method: 'DELETE', headers});

			expect(res.status).toBe(204);
		});
	});

	describe('POST /:bucket?delete - batch delete objects', () => {
		it('should delete multiple objects', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'file1.txt', Buffer.from('1'), {});
			await getS3Service().putObject('test-bucket', 'file2.txt', Buffer.from('2'), {});

			const deleteXml = `
				<Delete>
					<Object><Key>file1.txt</Key></Object>
					<Object><Key>file2.txt</Key></Object>
				</Delete>
			`;

			const {url, headers} = generateSignedRequest({
				method: 'POST',
				path: '/test-bucket?delete',
				body: deleteXml,
				contentType: 'application/xml',
			});

			const res = await app.request(url, {method: 'POST', headers, body: deleteXml});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<DeleteResult');
			expect(xml).toContain('<Key>file1.txt</Key>');
			expect(xml).toContain('<Key>file2.txt</Key>');
		});
	});

	describe('Multipart upload operations', () => {
		it('should initiate multipart upload', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'POST',
				path: '/test-bucket/large-file.bin?uploads',
				body: '',
				contentType: 'application/octet-stream',
			});

			const res = await app.request(url, {method: 'POST', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<InitiateMultipartUploadResult');
			expect(xml).toContain('<UploadId>');
			expect(xml).toContain('<Bucket>test-bucket</Bucket>');
			expect(xml).toContain('<Key>large-file.bin</Key>');
		});

		it('should upload part', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const upload = await getS3Service().createMultipartUpload('test-bucket', 'parts.bin', {});

			const partData = 'Part 1 data content';
			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: `/test-bucket/parts.bin?uploadId=${upload.uploadId}&partNumber=1`,
				body: partData,
			});

			const res = await app.request(url, {method: 'PUT', headers, body: partData});

			expect(res.status).toBe(200);
			expect(res.headers.get('ETag')).toBeTruthy();
		});

		it('should complete multipart upload', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const upload = await getS3Service().createMultipartUpload('test-bucket', 'complete.bin', {});
			const part1 = await getS3Service().uploadPart(
				'test-bucket',
				'complete.bin',
				upload.uploadId,
				1,
				Buffer.from('part1'),
			);
			const part2 = await getS3Service().uploadPart(
				'test-bucket',
				'complete.bin',
				upload.uploadId,
				2,
				Buffer.from('part2'),
			);

			const completeXml = `
				<CompleteMultipartUpload>
					<Part><PartNumber>1</PartNumber><ETag>${part1.etag}</ETag></Part>
					<Part><PartNumber>2</PartNumber><ETag>${part2.etag}</ETag></Part>
				</CompleteMultipartUpload>
			`;

			const {url, headers} = generateSignedRequest({
				method: 'POST',
				path: `/test-bucket/complete.bin?uploadId=${upload.uploadId}`,
				body: completeXml,
				contentType: 'application/xml',
			});

			const res = await app.request(url, {method: 'POST', headers, body: completeXml});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<CompleteMultipartUploadResult');
			expect(xml).toContain('<ETag>');
		});

		it('should list parts', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const upload = await getS3Service().createMultipartUpload('test-bucket', 'list-parts.bin', {});
			await getS3Service().uploadPart('test-bucket', 'list-parts.bin', upload.uploadId, 1, Buffer.from('part1'));
			await getS3Service().uploadPart('test-bucket', 'list-parts.bin', upload.uploadId, 2, Buffer.from('part2'));

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: `/test-bucket/list-parts.bin?uploadId=${upload.uploadId}`,
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<ListPartsResult');
			expect(xml).toContain('<PartNumber>1</PartNumber>');
			expect(xml).toContain('<PartNumber>2</PartNumber>');
		});

		it('should abort multipart upload', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const upload = await getS3Service().createMultipartUpload('test-bucket', 'abort.bin', {});
			await getS3Service().uploadPart('test-bucket', 'abort.bin', upload.uploadId, 1, Buffer.from('data'));

			const {url, headers} = generateSignedRequest({
				method: 'DELETE',
				path: `/test-bucket/abort.bin?uploadId=${upload.uploadId}`,
			});

			const res = await app.request(url, {method: 'DELETE', headers});

			expect(res.status).toBe(204);
		});

		it('should list parts with pagination options', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const upload = await getS3Service().createMultipartUpload('test-bucket', 'paginated-parts.bin', {});
			await getS3Service().uploadPart('test-bucket', 'paginated-parts.bin', upload.uploadId, 1, Buffer.from('part1'));
			await getS3Service().uploadPart('test-bucket', 'paginated-parts.bin', upload.uploadId, 2, Buffer.from('part2'));
			await getS3Service().uploadPart('test-bucket', 'paginated-parts.bin', upload.uploadId, 3, Buffer.from('part3'));

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: `/test-bucket/paginated-parts.bin?uploadId=${upload.uploadId}&max-parts=2&part-number-marker=0`,
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<ListPartsResult');
		});
	});

	describe('HEAD requests', () => {
		it('should HEAD an object', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'head-test.txt', Buffer.from('content'), {
				contentType: 'text/plain',
			});

			const {url, headers} = generateSignedRequest({
				method: 'HEAD',
				path: '/test-bucket/head-test.txt',
			});

			const res = await app.request(url, {method: 'HEAD', headers});

			expect(res.status).toBe(200);
			expect(res.headers.get('Content-Type')).toBe('text/plain');
			expect(res.headers.get('Content-Length')).toBe('7');
			expect(res.headers.get('ETag')).toBeTruthy();
		});

		it('should HEAD an object with user metadata', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'head-meta.txt', Buffer.from('content'), {
				metadata: {author: 'test'},
			});

			const {url, headers} = generateSignedRequest({
				method: 'HEAD',
				path: '/test-bucket/head-meta.txt',
			});

			const res = await app.request(url, {method: 'HEAD', headers});

			expect(res.status).toBe(200);
			expect(res.headers.get('x-amz-meta-author')).toBe('test');
		});

		it('should HEAD a bucket', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'HEAD',
				path: '/test-bucket',
			});

			const res = await app.request(url, {method: 'HEAD', headers});

			expect(res.status).toBe(200);
		});

		it('should return 404 for non-existent object HEAD', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'HEAD',
				path: '/test-bucket/nonexistent.txt',
			});

			const res = await app.request(url, {method: 'HEAD', headers});

			expect(res.status).toBe(404);
		});
	});

	describe('Conditional GET requests', () => {
		it('should return 304 for if-modified-since when not modified', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'modified.txt', Buffer.from('content'), {});

			const futureDate = new Date(Date.now() + 86400000).toUTCString();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/modified.txt',
				headers: {
					'if-modified-since': futureDate,
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(304);
		});

		it('should return object when modified after if-modified-since', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'modified2.txt', Buffer.from('content'), {});

			const pastDate = new Date(Date.now() - 86400000).toUTCString();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/modified2.txt',
				headers: {
					'if-modified-since': pastDate,
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
		});

		it('should return 412 for if-unmodified-since when modified', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'unmodified.txt', Buffer.from('content'), {});

			const pastDate = new Date(Date.now() - 86400000).toUTCString();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/unmodified.txt',
				headers: {
					'if-unmodified-since': pastDate,
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(412);
			const xml = await res.text();
			expect(xml).toContain('<Code>PreconditionFailed</Code>');
		});

		it('should return object for if-unmodified-since when not modified', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'unmodified2.txt', Buffer.from('content'), {});

			const futureDate = new Date(Date.now() + 86400000).toUTCString();

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/unmodified2.txt',
				headers: {
					'if-unmodified-since': futureDate,
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
		});
	});

	describe('List objects pagination', () => {
		it('should paginate with max-keys', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			for (let i = 0; i < 5; i++) {
				await getS3Service().putObject('test-bucket', `file${i}.txt`, Buffer.from(`${i}`), {});
			}

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?max-keys=2',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<IsTruncated>true</IsTruncated>');
		});

		it('should continue from marker', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'a.txt', Buffer.from('a'), {});
			await getS3Service().putObject('test-bucket', 'b.txt', Buffer.from('b'), {});
			await getS3Service().putObject('test-bucket', 'c.txt', Buffer.from('c'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?marker=a.txt',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).not.toContain('<Key>a.txt</Key>');
			expect(xml).toContain('<Key>b.txt</Key>');
		});

		it('should list with start-after for list-type 2', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'x.txt', Buffer.from('x'), {});
			await getS3Service().putObject('test-bucket', 'y.txt', Buffer.from('y'), {});
			await getS3Service().putObject('test-bucket', 'z.txt', Buffer.from('z'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?list-type=2&start-after=x.txt',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<StartAfter>x.txt</StartAfter>');
		});
	});

	describe('List multipart uploads with options', () => {
		it('should list multipart uploads with prefix', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().createMultipartUpload('test-bucket', 'prefix-a/upload.bin', {});
			await getS3Service().createMultipartUpload('test-bucket', 'prefix-b/upload.bin', {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?uploads&prefix=prefix-a/',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<Prefix>prefix-a/</Prefix>');
		});

		it('should list multipart uploads with max-uploads', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().createMultipartUpload('test-bucket', 'upload1.bin', {});
			await getS3Service().createMultipartUpload('test-bucket', 'upload2.bin', {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket?uploads&max-uploads=1',
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
			const xml = await res.text();
			expect(xml).toContain('<MaxUploads>1</MaxUploads>');
		});
	});

	describe('Invalid POST requests', () => {
		it('should return error for invalid POST on bucket', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'POST',
				path: '/test-bucket',
				body: '',
			});

			const res = await app.request(url, {method: 'POST', headers});

			expect(res.status).toBe(400);
			const xml = await res.text();
			expect(xml).toContain('<Code>InvalidArgument</Code>');
		});

		it('should return error for invalid POST on object', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'POST',
				path: '/test-bucket/file.txt',
				body: '',
			});

			const res = await app.request(url, {method: 'POST', headers});

			expect(res.status).toBe(400);
			const xml = await res.text();
			expect(xml).toContain('<Code>InvalidArgument</Code>');
		});
	});

	describe('Range requests edge cases', () => {
		it('should get object with open-ended range', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'range-open.txt', Buffer.from('Hello, World!'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/range-open.txt',
				headers: {
					range: 'bytes=7-',
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(206);
			const body = await res.text();
			expect(body).toBe('World!');
		});

		it('should handle invalid range header gracefully', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'range-invalid.txt', Buffer.from('Hello'), {});

			const {url, headers} = generateSignedRequest({
				method: 'GET',
				path: '/test-bucket/range-invalid.txt',
				headers: {
					range: 'invalid-range',
				},
			});

			const res = await app.request(url, {method: 'GET', headers});

			expect(res.status).toBe(200);
		});
	});

	describe('Delete bucket with delete query parameter', () => {
		it('should handle DELETE with delete query param', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'DELETE',
				path: '/test-bucket?delete',
			});

			const res = await app.request(url, {method: 'DELETE', headers});

			expect(res.status).toBe(200);
		});
	});

	describe('Copy object edge cases', () => {
		it('should return error for invalid copy source', async () => {
			const {app, initialize} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/test-bucket/destination.txt',
				body: '',
				headers: {
					'x-amz-copy-source': 'invalid-source',
				},
			});

			const res = await app.request(url, {method: 'PUT', headers});

			expect(res.status).toBe(400);
			const xml = await res.text();
			expect(xml).toContain('<Code>InvalidArgument</Code>');
		});

		it('should copy object without leading slash in source', async () => {
			const {app, initialize, getS3Service} = createS3App({
				logger: mockLogger,
				s3Config: {root: testRoot, buckets: ['test-bucket']},
				authConfig,
			});
			await initialize();

			await getS3Service().putObject('test-bucket', 'source.txt', Buffer.from('content'), {});

			const {url, headers} = generateSignedRequest({
				method: 'PUT',
				path: '/test-bucket/destination.txt',
				body: '',
				headers: {
					'x-amz-copy-source': 'test-bucket/source.txt',
				},
			});

			const res = await app.request(url, {method: 'PUT', headers});

			expect(res.status).toBe(200);
		});
	});
});
