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

import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import {FluxerError, type FluxerErrorStatus} from '@fluxer/errors/src/FluxerError';

export type S3ErrorCode =
	| 'AccessDenied'
	| 'AccountProblem'
	| 'BucketAlreadyExists'
	| 'BucketAlreadyOwnedByYou'
	| 'BucketNotEmpty'
	| 'EntityTooLarge'
	| 'EntityTooSmall'
	| 'ExpiredToken'
	| 'IllegalVersioningConfigurationException'
	| 'IncompleteBody'
	| 'IncorrectNumberOfFilesInPostRequest'
	| 'InlineDataTooLarge'
	| 'InternalError'
	| 'InvalidAccessKeyId'
	| 'InvalidArgument'
	| 'InvalidBucketName'
	| 'InvalidBucketState'
	| 'InvalidDigest'
	| 'InvalidLocationConstraint'
	| 'InvalidObjectState'
	| 'InvalidPart'
	| 'InvalidPartOrder'
	| 'InvalidRange'
	| 'InvalidRequest'
	| 'InvalidSecurity'
	| 'InvalidStorageClass'
	| 'InvalidTargetBucketForLogging'
	| 'InvalidToken'
	| 'InvalidURI'
	| 'KeyTooLongError'
	| 'MalformedACLError'
	| 'MalformedPOSTRequest'
	| 'MalformedXML'
	| 'MaxMessageLengthExceeded'
	| 'MaxPostPreDataLengthExceededError'
	| 'MetadataTooLarge'
	| 'MethodNotAllowed'
	| 'MissingContentLength'
	| 'MissingRequestBodyError'
	| 'MissingSecurityElement'
	| 'MissingSecurityHeader'
	| 'NoLoggingStatusForKey'
	| 'NoSuchBucket'
	| 'NoSuchBucketPolicy'
	| 'NoSuchKey'
	| 'NoSuchLifecycleConfiguration'
	| 'NoSuchUpload'
	| 'NoSuchVersion'
	| 'NotImplemented'
	| 'NotSignedUp'
	| 'OperationAborted'
	| 'PermanentRedirect'
	| 'PreconditionFailed'
	| 'Redirect'
	| 'RequestHeaderSectionTooLarge'
	| 'RequestIsNotMultiPartContent'
	| 'RequestTimeout'
	| 'RequestTimeTooSkewed'
	| 'RequestTorrentOfBucketError'
	| 'SignatureDoesNotMatch'
	| 'ServiceUnavailable'
	| 'SlowDown'
	| 'TemporaryRedirect'
	| 'TokenRefreshRequired'
	| 'TooManyBuckets'
	| 'UnexpectedContent'
	| 'UnresolvableGrantByEmailAddress'
	| 'UserKeyMustBeSpecified';

const S3_ERROR_STATUS_MAP: Record<S3ErrorCode, FluxerErrorStatus> = {
	AccessDenied: HttpStatus.FORBIDDEN,
	AccountProblem: HttpStatus.FORBIDDEN,
	BucketAlreadyExists: HttpStatus.CONFLICT,
	BucketAlreadyOwnedByYou: HttpStatus.CONFLICT,
	BucketNotEmpty: HttpStatus.CONFLICT,
	EntityTooLarge: HttpStatus.BAD_REQUEST,
	EntityTooSmall: HttpStatus.BAD_REQUEST,
	ExpiredToken: HttpStatus.BAD_REQUEST,
	IllegalVersioningConfigurationException: HttpStatus.BAD_REQUEST,
	IncompleteBody: HttpStatus.BAD_REQUEST,
	IncorrectNumberOfFilesInPostRequest: HttpStatus.BAD_REQUEST,
	InlineDataTooLarge: HttpStatus.BAD_REQUEST,
	InternalError: HttpStatus.INTERNAL_SERVER_ERROR,
	InvalidAccessKeyId: HttpStatus.FORBIDDEN,
	InvalidArgument: HttpStatus.BAD_REQUEST,
	InvalidBucketName: HttpStatus.BAD_REQUEST,
	InvalidBucketState: HttpStatus.CONFLICT,
	InvalidDigest: HttpStatus.BAD_REQUEST,
	InvalidLocationConstraint: HttpStatus.BAD_REQUEST,
	InvalidObjectState: HttpStatus.FORBIDDEN,
	InvalidPart: HttpStatus.BAD_REQUEST,
	InvalidPartOrder: HttpStatus.BAD_REQUEST,
	InvalidRange: HttpStatus.RANGE_NOT_SATISFIABLE,
	InvalidRequest: HttpStatus.BAD_REQUEST,
	InvalidSecurity: HttpStatus.FORBIDDEN,
	InvalidStorageClass: HttpStatus.BAD_REQUEST,
	InvalidTargetBucketForLogging: HttpStatus.BAD_REQUEST,
	InvalidToken: HttpStatus.BAD_REQUEST,
	InvalidURI: HttpStatus.BAD_REQUEST,
	KeyTooLongError: HttpStatus.BAD_REQUEST,
	MalformedACLError: HttpStatus.BAD_REQUEST,
	MalformedPOSTRequest: HttpStatus.BAD_REQUEST,
	MalformedXML: HttpStatus.BAD_REQUEST,
	MaxMessageLengthExceeded: HttpStatus.BAD_REQUEST,
	MaxPostPreDataLengthExceededError: HttpStatus.BAD_REQUEST,
	MetadataTooLarge: HttpStatus.BAD_REQUEST,
	MethodNotAllowed: HttpStatus.METHOD_NOT_ALLOWED,
	MissingContentLength: HttpStatus.LENGTH_REQUIRED,
	MissingRequestBodyError: HttpStatus.BAD_REQUEST,
	MissingSecurityElement: HttpStatus.BAD_REQUEST,
	MissingSecurityHeader: HttpStatus.BAD_REQUEST,
	NoLoggingStatusForKey: HttpStatus.BAD_REQUEST,
	NoSuchBucket: HttpStatus.NOT_FOUND,
	NoSuchBucketPolicy: HttpStatus.NOT_FOUND,
	NoSuchKey: HttpStatus.NOT_FOUND,
	NoSuchLifecycleConfiguration: HttpStatus.NOT_FOUND,
	NoSuchUpload: HttpStatus.NOT_FOUND,
	NoSuchVersion: HttpStatus.NOT_FOUND,
	NotImplemented: HttpStatus.NOT_IMPLEMENTED,
	NotSignedUp: HttpStatus.FORBIDDEN,
	OperationAborted: HttpStatus.CONFLICT,
	PermanentRedirect: HttpStatus.MOVED_PERMANENTLY,
	PreconditionFailed: HttpStatus.PRECONDITION_FAILED,
	Redirect: HttpStatus.TEMPORARY_REDIRECT,
	RequestHeaderSectionTooLarge: HttpStatus.BAD_REQUEST,
	RequestIsNotMultiPartContent: HttpStatus.BAD_REQUEST,
	RequestTimeout: HttpStatus.REQUEST_TIMEOUT,
	RequestTimeTooSkewed: HttpStatus.FORBIDDEN,
	RequestTorrentOfBucketError: HttpStatus.BAD_REQUEST,
	SignatureDoesNotMatch: HttpStatus.FORBIDDEN,
	ServiceUnavailable: HttpStatus.SERVICE_UNAVAILABLE,
	SlowDown: HttpStatus.SERVICE_UNAVAILABLE,
	TemporaryRedirect: HttpStatus.TEMPORARY_REDIRECT,
	TokenRefreshRequired: HttpStatus.BAD_REQUEST,
	TooManyBuckets: HttpStatus.BAD_REQUEST,
	UnexpectedContent: HttpStatus.BAD_REQUEST,
	UnresolvableGrantByEmailAddress: HttpStatus.BAD_REQUEST,
	UserKeyMustBeSpecified: HttpStatus.BAD_REQUEST,
};

export class S3Error extends FluxerError {
	readonly resource?: string;
	requestId?: string;

	constructor(
		code: S3ErrorCode,
		message: string,
		options?: {
			resource?: string;
			requestId?: string;
		},
	) {
		const status = S3_ERROR_STATUS_MAP[code];
		super({
			code,
			message,
			status,
		});
		this.name = 'S3Error';
		if (options?.resource !== undefined) {
			this.resource = options.resource;
		}
		if (options?.requestId !== undefined) {
			this.requestId = options.requestId;
		}
	}

	override getResponse(): Response {
		const xml = this.toXml();
		return new Response(xml, {
			status: this.status,
			headers: {
				'Content-Type': 'application/xml',
				'x-amz-request-id': this.requestId ?? 'unknown',
			},
		});
	}

	toXml(): string {
		let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
		xml += '<Error>\n';
		xml += `  <Code>${this.code}</Code>\n`;
		xml += `  <Message>${escapeXml(this.message)}</Message>\n`;
		if (this.resource) {
			xml += `  <Resource>${escapeXml(this.resource)}</Resource>\n`;
		}
		if (this.requestId) {
			xml += `  <RequestId>${escapeXml(this.requestId)}</RequestId>\n`;
		}
		xml += '</Error>';
		return xml;
	}
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const S3Errors = {
	accessDenied: (message = 'Access Denied', resource?: string) =>
		new S3Error('AccessDenied', message, resource !== undefined ? {resource} : undefined),

	bucketAlreadyExists: (bucket: string) =>
		new S3Error(
			'BucketAlreadyExists',
			'The requested bucket name is not available. The bucket namespace is shared by all users of the system. Please select a different name and try again.',
			{resource: bucket},
		),

	bucketAlreadyOwnedByYou: (bucket: string) =>
		new S3Error(
			'BucketAlreadyOwnedByYou',
			'Your previous request to create the named bucket succeeded and you already own it.',
			{resource: bucket},
		),

	bucketNotEmpty: (bucket: string) =>
		new S3Error('BucketNotEmpty', 'The bucket you tried to delete is not empty.', {resource: bucket}),

	internalError: (message = 'We encountered an internal error. Please try again.') =>
		new S3Error('InternalError', message),

	invalidAccessKeyId: () =>
		new S3Error('InvalidAccessKeyId', 'The AWS Access Key Id you provided does not exist in our records.'),

	invalidArgument: (message: string, resource?: string) =>
		new S3Error('InvalidArgument', message, resource !== undefined ? {resource} : undefined),

	invalidBucketName: (bucket: string) =>
		new S3Error('InvalidBucketName', 'The specified bucket is not valid.', {resource: bucket}),

	invalidDigest: () => new S3Error('InvalidDigest', 'The Content-MD5 you specified was invalid.'),

	invalidPart: () => new S3Error('InvalidPart', 'One or more of the specified parts could not be found.'),

	invalidPartOrder: () => new S3Error('InvalidPartOrder', 'The list of parts was not in ascending order.'),

	invalidRange: () => new S3Error('InvalidRange', 'The requested range is not satisfiable.'),

	malformedXml: (
		message = 'The XML you provided was not well-formed or did not validate against our published schema.',
	) => new S3Error('MalformedXML', message),

	methodNotAllowed: (_method: string, resource?: string) =>
		new S3Error(
			'MethodNotAllowed',
			'The specified method is not allowed against this resource.',
			resource !== undefined ? {resource} : undefined,
		),

	missingContentLength: () => new S3Error('MissingContentLength', 'You must provide the Content-Length HTTP header.'),

	noSuchBucket: (bucket: string) =>
		new S3Error('NoSuchBucket', 'The specified bucket does not exist.', {resource: bucket}),

	noSuchKey: (key: string) => new S3Error('NoSuchKey', 'The specified key does not exist.', {resource: key}),

	noSuchUpload: (uploadId: string) =>
		new S3Error(
			'NoSuchUpload',
			'The specified multipart upload does not exist. The upload ID may be invalid, or the upload may have been aborted or completed.',
			{resource: uploadId},
		),

	notImplemented: (message = 'A header you provided implies functionality that is not implemented.') =>
		new S3Error('NotImplemented', message),

	preconditionFailed: (_condition: string) =>
		new S3Error('PreconditionFailed', 'At least one of the preconditions you specified did not hold.'),

	requestTimeTooSkewed: () =>
		new S3Error('RequestTimeTooSkewed', 'The difference between the request time and the current time is too large.'),

	signatureDoesNotMatch: () =>
		new S3Error(
			'SignatureDoesNotMatch',
			'The request signature we calculated does not match the signature you provided.',
		),

	entityTooLarge: (_maxSize: number) =>
		new S3Error('EntityTooLarge', 'Your proposed upload exceeds the maximum allowed object size.'),

	entityTooSmall: () =>
		new S3Error('EntityTooSmall', 'Your proposed upload is smaller than the minimum allowed object size.'),
};
