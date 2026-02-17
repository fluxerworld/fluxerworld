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

import {timingSafeEqual} from 'node:crypto';
import {S3Errors} from '@fluxer/s3/src/errors/S3Error';
import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import {hmacSha256, sha256} from '@fluxer/s3/src/utils/Crypto';
import type {Context} from 'hono';

interface S3AuthCredentials {
	accessKey: string;
	secretKey: string;
}

interface AwsCredential {
	accessKeyId: string;
	date: string;
	region: string;
	service: string;
}

interface AuthorizationParams {
	credential: AwsCredential;
	signedHeaders: Array<string>;
	signature: string;
}

interface S3AuthenticationResult {
	accessKeyId: string;
}

type S3Context = Context<HonoEnv>;

const MAX_TIME_SKEW_MS = 15 * 60 * 1000;

export async function authenticateS3Request(
	ctx: S3Context,
	credentials: S3AuthCredentials,
): Promise<S3AuthenticationResult> {
	const authHeader = ctx.req.header('authorization');
	const url = new URL(ctx.req.url);
	const algorithm = url.searchParams.get('X-Amz-Algorithm');

	if (algorithm === 'AWS4-HMAC-SHA256') {
		return verifyPresignedUrl(ctx, url, credentials);
	}

	if (authHeader?.startsWith('AWS4-HMAC-SHA256')) {
		return verifyAuthorizationHeader(ctx, authHeader, credentials);
	}

	throw S3Errors.accessDenied('No valid authentication provided');
}

async function verifyAuthorizationHeader(
	ctx: S3Context,
	authHeader: string,
	credentials: S3AuthCredentials,
): Promise<S3AuthenticationResult> {
	const params = parseAuthorizationHeader(authHeader);

	if (params.credential.accessKeyId !== credentials.accessKey) {
		throw S3Errors.invalidAccessKeyId();
	}

	const amzDate = ctx.req.header('x-amz-date');
	if (!amzDate) {
		throw S3Errors.invalidArgument('Missing X-Amz-Date header');
	}

	const requestTime = parseAmzDateToMs(amzDate);
	const now = Date.now();
	if (Math.abs(now - requestTime) > MAX_TIME_SKEW_MS) {
		throw S3Errors.accessDenied('Request timestamp is outside the allowed time window');
	}

	const isValid = await verifySignature(ctx, params, amzDate, credentials.secretKey, false);
	if (!isValid) {
		throw S3Errors.signatureDoesNotMatch();
	}

	return {accessKeyId: params.credential.accessKeyId};
}

async function verifyPresignedUrl(
	ctx: S3Context,
	url: URL,
	credentials: S3AuthCredentials,
): Promise<S3AuthenticationResult> {
	const credential = url.searchParams.get('X-Amz-Credential');
	const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders');
	const signature = url.searchParams.get('X-Amz-Signature');
	const amzDate = url.searchParams.get('X-Amz-Date');
	const expires = url.searchParams.get('X-Amz-Expires');

	if (!credential || !signedHeaders || !signature || !amzDate) {
		throw S3Errors.invalidArgument('Missing presigned URL parameters');
	}

	const credentialParts = credential.split('/');
	if (credentialParts.length !== 5) {
		throw S3Errors.invalidArgument('Invalid credential format');
	}

	const [accessKeyId, date, region, service] = credentialParts;

	if (accessKeyId !== credentials.accessKey) {
		throw S3Errors.invalidAccessKeyId();
	}

	if (expires) {
		const expiresSeconds = parseInt(expires, 10);
		const requestDate = parseAmzDateToMs(amzDate);
		if (Date.now() > requestDate + expiresSeconds * 1000) {
			throw S3Errors.accessDenied('Request has expired');
		}
	}

	const params: AuthorizationParams = {
		credential: {
			accessKeyId: accessKeyId!,
			date: date!,
			region: region!,
			service: service!,
		},
		signedHeaders: signedHeaders.split(';'),
		signature,
	};

	const isValid = await verifySignature(ctx, params, amzDate, credentials.secretKey, true);
	if (!isValid) {
		throw S3Errors.signatureDoesNotMatch();
	}

	return {accessKeyId};
}

function parseAuthorizationHeader(header: string): AuthorizationParams {
	const match = header.match(
		/^AWS4-HMAC-SHA256\s+Credential=([^,]+),\s*SignedHeaders=([^,]+),\s*Signature=([a-fA-F0-9]+)$/,
	);

	if (!match) {
		throw S3Errors.invalidArgument('Invalid Authorization header format');
	}

	const [, credentialStr, signedHeadersStr, signature] = match;
	const credentialParts = credentialStr!.split('/');

	if (credentialParts.length !== 5) {
		throw S3Errors.invalidArgument('Invalid credential format');
	}

	const [accessKeyId, date, region, service, request] = credentialParts;

	if (request !== 'aws4_request') {
		throw S3Errors.invalidArgument('Invalid credential terminator');
	}

	return {
		credential: {
			accessKeyId: accessKeyId!,
			date: date!,
			region: region!,
			service: service!,
		},
		signedHeaders: signedHeadersStr!.split(';'),
		signature: signature!,
	};
}

function parseAmzDateToMs(amzDate: string): number {
	const year = parseInt(amzDate.slice(0, 4), 10);
	const month = parseInt(amzDate.slice(4, 6), 10) - 1;
	const day = parseInt(amzDate.slice(6, 8), 10);
	const hour = parseInt(amzDate.slice(9, 11), 10);
	const minute = parseInt(amzDate.slice(11, 13), 10);
	const second = parseInt(amzDate.slice(13, 15), 10);
	return Date.UTC(year, month, day, hour, minute, second);
}

async function verifySignature(
	ctx: S3Context,
	params: AuthorizationParams,
	amzDate: string,
	secretKey: string,
	isPresigned: boolean,
): Promise<boolean> {
	const method = ctx.req.method;
	const url = new URL(ctx.req.url);

	const canonicalUri = url.pathname;

	const queryParams = new Map<string, string>();
	url.searchParams.forEach((value, key) => {
		if (key !== 'X-Amz-Signature') {
			queryParams.set(key, value);
		}
	});
	const sortedQueryKeys = Array.from(queryParams.keys()).sort();
	const canonicalQueryString = sortedQueryKeys
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams.get(key)!)}`)
		.join('&');

	const effectiveHost = ctx.req.header('x-forwarded-host') ?? ctx.req.header('host') ?? url.host;
	const canonicalHeaders = params.signedHeaders
		.map((header) => {
			const value = ctx.req.header(header) ?? (header.toLowerCase() === 'host' ? effectiveHost : undefined);
			if (value === undefined) {
				throw S3Errors.invalidArgument(`Missing signed header: ${header}`);
			}
			return `${header.toLowerCase()}:${value.trim()}\n`;
		})
		.join('');

	const signedHeadersString = params.signedHeaders.join(';');

	let payloadHash: string;
	if (isPresigned) {
		payloadHash = 'UNSIGNED-PAYLOAD';
	} else {
		const contentSha256 = ctx.req.header('x-amz-content-sha256');
		if (contentSha256) {
			payloadHash = contentSha256;
		} else {
			payloadHash = 'UNSIGNED-PAYLOAD';
		}
	}

	const canonicalRequest = [
		method,
		canonicalUri,
		canonicalQueryString,
		canonicalHeaders,
		signedHeadersString,
		payloadHash,
	].join('\n');

	const dateStamp = params.credential.date;
	const scope = `${dateStamp}/${params.credential.region}/${params.credential.service}/aws4_request`;
	const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

	const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
	const kRegion = hmacSha256(kDate, params.credential.region);
	const kService = hmacSha256(kRegion, params.credential.service);
	const kSigning = hmacSha256(kService, 'aws4_request');
	const calculatedSignature = hmacSha256(kSigning, stringToSign).toString('hex');

	const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');
	const providedBuffer = Buffer.from(params.signature, 'hex');
	if (calculatedBuffer.length !== providedBuffer.length) {
		return false;
	}
	return timingSafeEqual(calculatedBuffer, providedBuffer);
}
