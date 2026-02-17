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

import type {PresignedUrlOptions} from '@fluxer/s3/src/s3/PresignedUrlGenerator';
import {generatePresignedUrl} from '@fluxer/s3/src/s3/PresignedUrlGenerator';
import {describe, expect, it} from 'vitest';

describe('generatePresignedUrl', () => {
	const baseOptions: PresignedUrlOptions = {
		method: 'GET',
		bucket: 'test-bucket',
		key: 'test-key.txt',
		expiresIn: 300,
		accessKey: 'test-access-key',
		secretKey: 'test-secret-key',
		endpoint: 'http://localhost:8080',
		region: 'us-east-1',
	};

	describe('URL structure', () => {
		it('should generate URL with correct endpoint and path', () => {
			const url = generatePresignedUrl(baseOptions);

			expect(url).toContain('http://localhost:8080/test-bucket/test-key.txt?');
		});

		it('should include all required AWS signature parameters', () => {
			const url = new URL(generatePresignedUrl(baseOptions));

			expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
			expect(url.searchParams.get('X-Amz-Credential')).toBeTruthy();
			expect(url.searchParams.get('X-Amz-Date')).toBeTruthy();
			expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
			expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
			expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
		});
	});

	describe('credential format', () => {
		it('should format credential with correct structure', () => {
			const url = new URL(generatePresignedUrl(baseOptions));
			const credential = url.searchParams.get('X-Amz-Credential');

			expect(credential).toMatch(/^test-access-key\/\d{8}\/us-east-1\/s3\/aws4_request$/);
		});

		it('should use current date in credential', () => {
			const url = new URL(generatePresignedUrl(baseOptions));
			const credential = url.searchParams.get('X-Amz-Credential');
			const dateStamp = credential?.split('/')[1];

			const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
			expect(dateStamp).toBe(today);
		});
	});

	describe('signature', () => {
		it('should generate same signature for same inputs', () => {
			const url1 = generatePresignedUrl(baseOptions);
			const url2 = generatePresignedUrl(baseOptions);

			expect(url1).toBe(url2);
		});

		it('should generate different signatures for different access keys', () => {
			const opts1 = {...baseOptions, accessKey: 'key1'};
			const opts2 = {...baseOptions, accessKey: 'key2'};

			const sig1 = new URL(generatePresignedUrl(opts1)).searchParams.get('X-Amz-Signature');
			const sig2 = new URL(generatePresignedUrl(opts2)).searchParams.get('X-Amz-Signature');

			expect(sig1).not.toBe(sig2);
		});

		it('should generate different signatures for different secret keys', () => {
			const opts1 = {...baseOptions, secretKey: 'secret1'};
			const opts2 = {...baseOptions, secretKey: 'secret2'};

			const sig1 = new URL(generatePresignedUrl(opts1)).searchParams.get('X-Amz-Signature');
			const sig2 = new URL(generatePresignedUrl(opts2)).searchParams.get('X-Amz-Signature');

			expect(sig1).not.toBe(sig2);
		});

		it('should generate different signatures for different expiration times', () => {
			const opts1 = {...baseOptions, expiresIn: 300};
			const opts2 = {...baseOptions, expiresIn: 600};

			const sig1 = new URL(generatePresignedUrl(opts1)).searchParams.get('X-Amz-Signature');
			const sig2 = new URL(generatePresignedUrl(opts2)).searchParams.get('X-Amz-Signature');

			expect(sig1).not.toBe(sig2);
		});
	});

	describe('HTTP methods', () => {
		it('should support GET method', () => {
			const opts = {...baseOptions, method: 'GET' as const};
			const url = generatePresignedUrl(opts);

			expect(url).toBeTruthy();
			expect(url).toContain('test-bucket/test-key.txt?');
		});

		it('should support PUT method', () => {
			const opts = {...baseOptions, method: 'PUT' as const};
			const url = generatePresignedUrl(opts);

			expect(url).toBeTruthy();
			const signature = new URL(url).searchParams.get('X-Amz-Signature');
			expect(signature).toBeTruthy();
			expect(signature?.length).toBeGreaterThan(0);
		});

		it('should support DELETE method', () => {
			const opts = {...baseOptions, method: 'DELETE' as const};
			const url = generatePresignedUrl(opts);

			expect(url).toBeTruthy();
			const signature = new URL(url).searchParams.get('X-Amz-Signature');
			expect(signature).toBeTruthy();
		});

		it('should generate different signatures for different methods', () => {
			const urlGet = generatePresignedUrl({...baseOptions, method: 'GET'});
			const urlPut = generatePresignedUrl({...baseOptions, method: 'PUT'});
			const urlDelete = generatePresignedUrl({...baseOptions, method: 'DELETE'});

			const sigGet = new URL(urlGet).searchParams.get('X-Amz-Signature');
			const sigPut = new URL(urlPut).searchParams.get('X-Amz-Signature');
			const sigDelete = new URL(urlDelete).searchParams.get('X-Amz-Signature');

			expect(sigGet).not.toBe(sigPut);
			expect(sigGet).not.toBe(sigDelete);
			expect(sigPut).not.toBe(sigDelete);
		});
	});

	describe('regions', () => {
		it('should default to us-east-1 region', () => {
			const opts = {...baseOptions, region: undefined};
			const url = new URL(generatePresignedUrl(opts));
			const credential = url.searchParams.get('X-Amz-Credential');

			expect(credential).toContain('/us-east-1/s3/aws4_request');
		});

		it('should use custom region when specified', () => {
			const opts = {...baseOptions, region: 'eu-west-1'};
			const url = new URL(generatePresignedUrl(opts));
			const credential = url.searchParams.get('X-Amz-Credential');

			expect(credential).toContain('/eu-west-1/s3/aws4_request');
		});
	});

	describe('bucket and key handling', () => {
		it('should handle keys with special characters', () => {
			const opts = {...baseOptions, key: 'path/to/file with spaces.txt'};
			const url = generatePresignedUrl(opts);

			expect(url).toContain('path/to/file with spaces.txt?');
		});

		it('should handle keys with forward slashes', () => {
			const opts = {...baseOptions, key: 'folder/subfolder/file.txt'};
			const url = generatePresignedUrl(opts);

			expect(url).toContain('/test-bucket/folder/subfolder/file.txt?');
		});

		it('should handle bucket names with periods', () => {
			const opts = {...baseOptions, bucket: 'my.bucket.com'};
			const url = generatePresignedUrl(opts);

			expect(url).toContain('/my.bucket.com/');
		});
	});

	describe('endpoint handling', () => {
		it('should handle http endpoint', () => {
			const opts = {...baseOptions, endpoint: 'http://example.com'};
			const url = new URL(generatePresignedUrl(opts));

			expect(url.protocol).toBe('http:');
			expect(url.hostname).toBe('example.com');
		});

		it('should handle https endpoint', () => {
			const opts = {...baseOptions, endpoint: 'https://example.com'};
			const url = new URL(generatePresignedUrl(opts));

			expect(url.protocol).toBe('https:');
			expect(url.hostname).toBe('example.com');
		});

		it('should handle endpoint with port', () => {
			const opts = {...baseOptions, endpoint: 'http://localhost:9000'};
			const url = new URL(generatePresignedUrl(opts));

			expect(url.hostname).toBe('localhost');
			expect(url.port).toBe('9000');
		});
	});
});
