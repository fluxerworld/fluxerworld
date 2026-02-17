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

import {S3Error, S3Errors} from '@fluxer/s3/src/errors/S3Error';
import {describe, expect, it} from 'vitest';

describe('S3Error', () => {
	describe('constructor', () => {
		it('should create error with correct properties', () => {
			const error = new S3Error('NoSuchBucket', 'The bucket does not exist', {
				resource: 'my-bucket',
				requestId: 'req-123',
			});

			expect(error.code).toBe('NoSuchBucket');
			expect(error.message).toBe('The bucket does not exist');
			expect(error.resource).toBe('my-bucket');
			expect(error.requestId).toBe('req-123');
			expect(error.status).toBe(404);
		});

		it('should map error codes to correct HTTP status', () => {
			expect(new S3Error('AccessDenied', 'test').status).toBe(403);
			expect(new S3Error('NoSuchBucket', 'test').status).toBe(404);
			expect(new S3Error('NoSuchKey', 'test').status).toBe(404);
			expect(new S3Error('BucketAlreadyExists', 'test').status).toBe(409);
			expect(new S3Error('BucketNotEmpty', 'test').status).toBe(409);
			expect(new S3Error('InternalError', 'test').status).toBe(500);
			expect(new S3Error('InvalidArgument', 'test').status).toBe(400);
			expect(new S3Error('InvalidRange', 'test').status).toBe(416);
			expect(new S3Error('MissingContentLength', 'test').status).toBe(411);
			expect(new S3Error('PreconditionFailed', 'test').status).toBe(412);
		});
	});

	describe('toXml', () => {
		it('should generate valid XML error response', () => {
			const error = new S3Error('NoSuchBucket', 'The bucket does not exist', {
				resource: 'my-bucket',
				requestId: 'req-123',
			});

			const xml = error.toXml();

			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain('<Error>');
			expect(xml).toContain('<Code>NoSuchBucket</Code>');
			expect(xml).toContain('<Message>The bucket does not exist</Message>');
			expect(xml).toContain('<Resource>my-bucket</Resource>');
			expect(xml).toContain('<RequestId>req-123</RequestId>');
			expect(xml).toContain('</Error>');
		});

		it('should escape special characters in XML', () => {
			const error = new S3Error('InvalidArgument', 'Value <test> is invalid', {
				resource: 'key&name',
			});

			const xml = error.toXml();

			expect(xml).toContain('<Message>Value &lt;test&gt; is invalid</Message>');
			expect(xml).toContain('<Resource>key&amp;name</Resource>');
		});

		it('should omit optional fields if not provided', () => {
			const error = new S3Error('InternalError', 'Something went wrong');

			const xml = error.toXml();

			expect(xml).not.toContain('<Resource>');
			expect(xml).not.toContain('<RequestId>');
		});
	});

	describe('getResponse', () => {
		it('should return Response with correct status and headers', () => {
			const error = new S3Error('NoSuchBucket', 'The bucket does not exist', {
				requestId: 'req-123',
			});

			const response = error.getResponse();

			expect(response.status).toBe(404);
			expect(response.headers.get('Content-Type')).toBe('application/xml');
			expect(response.headers.get('x-amz-request-id')).toBe('req-123');
		});

		it('should default requestId to unknown if not set', () => {
			const error = new S3Error('InternalError', 'test');
			const response = error.getResponse();

			expect(response.headers.get('x-amz-request-id')).toBe('unknown');
		});
	});
});

describe('S3Errors factory functions', () => {
	it('accessDenied should create AccessDenied error', () => {
		const error = S3Errors.accessDenied('Custom message', 'resource');
		expect(error.code).toBe('AccessDenied');
		expect(error.message).toBe('Custom message');
		expect(error.resource).toBe('resource');
		expect(error.status).toBe(403);
	});

	it('accessDenied should use default message', () => {
		const error = S3Errors.accessDenied();
		expect(error.message).toBe('Access Denied');
	});

	it('signatureDoesNotMatch should create SignatureDoesNotMatch error', () => {
		const error = S3Errors.signatureDoesNotMatch();
		expect(error.code).toBe('SignatureDoesNotMatch');
		expect(error.status).toBe(403);
	});

	it('noSuchBucket should create NoSuchBucket error', () => {
		const error = S3Errors.noSuchBucket('missing-bucket');
		expect(error.code).toBe('NoSuchBucket');
		expect(error.resource).toBe('missing-bucket');
		expect(error.status).toBe(404);
	});

	it('noSuchKey should create NoSuchKey error', () => {
		const error = S3Errors.noSuchKey('missing-key');
		expect(error.code).toBe('NoSuchKey');
		expect(error.resource).toBe('missing-key');
		expect(error.status).toBe(404);
	});

	it('noSuchUpload should create NoSuchUpload error', () => {
		const error = S3Errors.noSuchUpload('upload-id');
		expect(error.code).toBe('NoSuchUpload');
		expect(error.resource).toBe('upload-id');
	});

	it('bucketAlreadyOwnedByYou should create BucketAlreadyOwnedByYou error', () => {
		const error = S3Errors.bucketAlreadyOwnedByYou('my-bucket');
		expect(error.code).toBe('BucketAlreadyOwnedByYou');
		expect(error.status).toBe(409);
	});

	it('bucketNotEmpty should create BucketNotEmpty error', () => {
		const error = S3Errors.bucketNotEmpty('my-bucket');
		expect(error.code).toBe('BucketNotEmpty');
		expect(error.status).toBe(409);
	});

	it('invalidAccessKeyId should create InvalidAccessKeyId error', () => {
		const error = S3Errors.invalidAccessKeyId();
		expect(error.code).toBe('InvalidAccessKeyId');
		expect(error.status).toBe(403);
	});

	it('invalidArgument should create InvalidArgument error', () => {
		const error = S3Errors.invalidArgument('Bad value');
		expect(error.code).toBe('InvalidArgument');
		expect(error.message).toBe('Bad value');
		expect(error.status).toBe(400);
	});

	it('invalidBucketName should create InvalidBucketName error', () => {
		const error = S3Errors.invalidBucketName('bad_bucket');
		expect(error.code).toBe('InvalidBucketName');
		expect(error.status).toBe(400);
	});

	it('invalidRange should create InvalidRange error', () => {
		const error = S3Errors.invalidRange();
		expect(error.code).toBe('InvalidRange');
		expect(error.status).toBe(416);
	});

	it('invalidPart should create InvalidPart error', () => {
		const error = S3Errors.invalidPart();
		expect(error.code).toBe('InvalidPart');
	});

	it('invalidPartOrder should create InvalidPartOrder error', () => {
		const error = S3Errors.invalidPartOrder();
		expect(error.code).toBe('InvalidPartOrder');
	});

	it('missingContentLength should create MissingContentLength error', () => {
		const error = S3Errors.missingContentLength();
		expect(error.code).toBe('MissingContentLength');
		expect(error.status).toBe(411);
	});

	it('notImplemented should create NotImplemented error', () => {
		const error = S3Errors.notImplemented();
		expect(error.code).toBe('NotImplemented');
	});

	it('preconditionFailed should create PreconditionFailed error', () => {
		const error = S3Errors.preconditionFailed('If-Match');
		expect(error.code).toBe('PreconditionFailed');
		expect(error.status).toBe(412);
	});

	it('requestTimeTooSkewed should create RequestTimeTooSkewed error', () => {
		const error = S3Errors.requestTimeTooSkewed();
		expect(error.code).toBe('RequestTimeTooSkewed');
	});

	it('entityTooLarge should create EntityTooLarge error', () => {
		const error = S3Errors.entityTooLarge(1024);
		expect(error.code).toBe('EntityTooLarge');
	});

	it('entityTooSmall should create EntityTooSmall error', () => {
		const error = S3Errors.entityTooSmall();
		expect(error.code).toBe('EntityTooSmall');
	});
});
