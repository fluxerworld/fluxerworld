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

import {hmacSha256, sha256} from '@fluxer/s3/src/utils/Crypto';

export interface PresignedUrlOptions {
	method: 'GET' | 'PUT' | 'DELETE';
	bucket: string;
	key: string;
	expiresIn: number;
	accessKey: string;
	secretKey: string;
	endpoint: string;
	region?: string;
}

export function generatePresignedUrl(options: PresignedUrlOptions): string {
	const {method, bucket, key, expiresIn, accessKey, secretKey, endpoint, region = 'us-east-1'} = options;

	const endpointUrl = new URL(endpoint);
	const host = endpointUrl.host;
	const basePath = endpointUrl.pathname === '/' ? '' : endpointUrl.pathname;

	const service = 's3';
	const algorithm = 'AWS4-HMAC-SHA256';

	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d+/g, '');
	const dateStamp = amzDate.slice(0, 8);

	const canonicalUri = `${basePath}/${bucket}/${key}`;

	const canonicalQuery = [
		`X-Amz-Algorithm=${algorithm}`,
		`X-Amz-Credential=${encodeURIComponent(`${accessKey}/${dateStamp}/${region}/${service}/aws4_request`)}`,
		`X-Amz-Date=${amzDate}`,
		`X-Amz-Expires=${expiresIn}`,
		`X-Amz-SignedHeaders=host`,
	].join('&');

	const canonicalHeaders = `host:${host}\n`;
	const signedHeadersString = 'host';

	const payloadHash = 'UNSIGNED-PAYLOAD';

	const canonicalRequest = [
		method,
		canonicalUri,
		canonicalQuery,
		canonicalHeaders,
		signedHeadersString,
		payloadHash,
	].join('\n');

	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
	const stringToSign = [algorithm, amzDate, credentialScope, sha256(canonicalRequest)].join('\n');

	const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
	const kRegion = hmacSha256(kDate, region);
	const kService = hmacSha256(kRegion, service);
	const kSigning = hmacSha256(kService, 'aws4_request');
	const signature = hmacSha256(kSigning, stringToSign).toString('hex');

	const baseUrl = `${endpointUrl.protocol}//${endpointUrl.host}`;
	return `${baseUrl}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
