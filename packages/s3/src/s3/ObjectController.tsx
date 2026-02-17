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

import {S3Errors} from '@fluxer/s3/src/errors/S3Error';
import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import {formatISODate, xmlHeader, xmlTag} from '@fluxer/s3/src/utils/XmlUtils';
import type {Hono} from 'hono';
import {stream} from 'hono/streaming';

export function ObjectController(app: Hono<HonoEnv>) {
	app.post('/:bucket', async (ctx) => {
		const bucket = ctx.req.param('bucket');
		const url = new URL(ctx.req.url);
		const s3Service = ctx.get('s3Service');

		if (url.searchParams.has('delete')) {
			const bodyText = await ctx.req.text();
			const keys = parseDeleteObjectsXml(bodyText);

			const result = await s3Service.deleteObjects(bucket, keys);

			let xml = xmlHeader();
			xml += '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';

			for (const key of result.deleted) {
				xml += '  <Deleted>\n';
				xml += `    ${xmlTag('Key', key)}\n`;
				xml += '  </Deleted>\n';
			}

			for (const error of result.errors) {
				xml += '  <Error>\n';
				xml += `    ${xmlTag('Key', error.key)}\n`;
				xml += `    ${xmlTag('Code', error.code)}\n`;
				xml += `    ${xmlTag('Message', error.message)}\n`;
				xml += '  </Error>\n';
			}

			xml += '</DeleteResult>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		throw S3Errors.invalidArgument('Invalid POST request');
	});

	app.post('/:bucket/:key{.+}', async (ctx) => {
		const bucket = ctx.req.param('bucket');
		const key = ctx.req.param('key');
		const url = new URL(ctx.req.url);
		const s3Service = ctx.get('s3Service');

		if (url.searchParams.has('uploads')) {
			const contentType = ctx.req.header('content-type') ?? 'application/octet-stream';
			const metadata = extractUserMetadata(ctx.req.raw.headers);

			const result = await s3Service.createMultipartUpload(bucket, key, {
				contentType,
				metadata,
			});

			let xml = xmlHeader();
			xml += '<InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
			xml += `  ${xmlTag('Bucket', bucket)}\n`;
			xml += `  ${xmlTag('Key', key)}\n`;
			xml += `  ${xmlTag('UploadId', result.uploadId)}\n`;
			xml += '</InitiateMultipartUploadResult>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		const uploadId = url.searchParams.get('uploadId');
		if (uploadId) {
			const bodyText = await ctx.req.text();
			const parts = parseCompleteMultipartUploadXml(bodyText);

			const result = await s3Service.completeMultipartUpload(bucket, key, uploadId, parts);

			let xml = xmlHeader();
			xml += '<CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
			xml += `  ${xmlTag('Location', result.location)}\n`;
			xml += `  ${xmlTag('Bucket', bucket)}\n`;
			xml += `  ${xmlTag('Key', key)}\n`;
			xml += `  ${xmlTag('ETag', result.etag)}\n`;
			xml += '</CompleteMultipartUploadResult>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		throw S3Errors.invalidArgument('Invalid POST request');
	});

	app.get('/:bucket/:key{.+}', async (ctx) => {
		const bucket = ctx.req.param('bucket');
		const key = ctx.req.param('key');
		const url = new URL(ctx.req.url);
		const s3Service = ctx.get('s3Service');

		if (ctx.req.method === 'HEAD') {
			const metadata = await s3Service.headObject(bucket, key);

			const headers: Record<string, string> = {
				'Content-Type': metadata.contentType ?? 'application/octet-stream',
				'Content-Length': String(metadata.size),
				ETag: metadata.etag,
				'Last-Modified': new Date(metadata.lastModified).toUTCString(),
				'Accept-Ranges': 'bytes',
			};

			for (const metaKey of Object.keys(metadata.metadata)) {
				headers[`x-amz-meta-${metaKey}`] = metadata.metadata[metaKey]!;
			}

			return ctx.body(null, 200, headers);
		}

		const uploadId = url.searchParams.get('uploadId');
		if (uploadId) {
			const maxParts = url.searchParams.get('max-parts');
			const partNumberMarker = url.searchParams.get('part-number-marker');

			const result = await s3Service.listParts(bucket, key, uploadId, {
				...(maxParts !== null && {maxParts: parseInt(maxParts, 10)}),
				...(partNumberMarker !== null && {partNumberMarker: parseInt(partNumberMarker, 10)}),
			});

			let xml = xmlHeader();
			xml += '<ListPartsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
			xml += `  ${xmlTag('Bucket', bucket)}\n`;
			xml += `  ${xmlTag('Key', key)}\n`;
			xml += `  ${xmlTag('UploadId', uploadId)}\n`;
			xml += '  <Initiator>\n';
			xml += `    ${xmlTag('ID', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += `    ${xmlTag('DisplayName', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += '  </Initiator>\n';
			xml += '  <Owner>\n';
			xml += `    ${xmlTag('ID', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += `    ${xmlTag('DisplayName', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += '  </Owner>\n';
			xml += '  <StorageClass>STANDARD</StorageClass>\n';
			xml += `  ${xmlTag('IsTruncated', result.isTruncated)}\n`;
			if (result.nextPartNumberMarker) {
				xml += `  ${xmlTag('NextPartNumberMarker', result.nextPartNumberMarker)}\n`;
			}

			for (const part of result.parts) {
				xml += '  <Part>\n';
				xml += `    ${xmlTag('PartNumber', part.partNumber)}\n`;
				xml += `    ${xmlTag('LastModified', formatISODate(part.lastModified))}\n`;
				xml += `    ${xmlTag('ETag', part.etag)}\n`;
				xml += `    ${xmlTag('Size', part.size)}\n`;
				xml += '  </Part>\n';
			}

			xml += '</ListPartsResult>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		if (url.searchParams.has('acl')) {
			await s3Service.headObject(bucket, key);

			let xml = xmlHeader();
			xml += '<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
			xml += '  <Owner>\n';
			xml += `    ${xmlTag('ID', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += `    ${xmlTag('DisplayName', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += '  </Owner>\n';
			xml += '  <AccessControlList>\n';
			xml += '    <Grant>\n';
			xml += '      <Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser">\n';
			xml += `        ${xmlTag('ID', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += `        ${xmlTag('DisplayName', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += '      </Grantee>\n';
			xml += '      <Permission>FULL_CONTROL</Permission>\n';
			xml += '    </Grant>\n';
			xml += '  </AccessControlList>\n';
			xml += '</AccessControlPolicy>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		const rangeHeader = ctx.req.header('range');
		let range: {start: number; end: number} | undefined;

		if (rangeHeader) {
			const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
			if (match) {
				const start = parseInt(match[1]!, 10);
				const end = match[2] ? parseInt(match[2], 10) : Infinity;
				range = {start, end};
			}
		}

		const ifMatch = ctx.req.header('if-match');
		const ifNoneMatch = ctx.req.header('if-none-match');
		const ifModifiedSince = ctx.req.header('if-modified-since');
		const ifUnmodifiedSince = ctx.req.header('if-unmodified-since');

		const result = await s3Service.getObject(bucket, key, range !== undefined ? {range} : undefined);

		if (ifMatch && result.metadata.etag !== ifMatch) {
			throw S3Errors.preconditionFailed('If-Match');
		}

		if (ifNoneMatch && result.metadata.etag === ifNoneMatch) {
			return ctx.body(null, 304);
		}

		if (ifModifiedSince) {
			const date = new Date(ifModifiedSince);
			if (new Date(result.metadata.lastModified) <= date) {
				return ctx.body(null, 304);
			}
		}

		if (ifUnmodifiedSince) {
			const date = new Date(ifUnmodifiedSince);
			if (new Date(result.metadata.lastModified) > date) {
				throw S3Errors.preconditionFailed('If-Unmodified-Since');
			}
		}

		const headers: Record<string, string> = {
			'Content-Type': result.metadata.contentType ?? 'application/octet-stream',
			ETag: result.metadata.etag,
			'Last-Modified': new Date(result.metadata.lastModified).toUTCString(),
			'Accept-Ranges': 'bytes',
		};

		for (const [metaKey, metaValue] of Object.entries(result.metadata.metadata)) {
			headers[`x-amz-meta-${metaKey}`] = metaValue;
		}

		if (result.contentRange) {
			headers['Content-Range'] = result.contentRange;
			headers['Content-Length'] = String(
				parseInt(result.contentRange.split('/')[0]!.split('-')[1]!, 10) -
					parseInt(result.contentRange.split('/')[0]!.split('-')[0]!.split(' ')[1]!, 10) +
					1,
			);
			ctx.status(206);
		} else {
			headers['Content-Length'] = String(result.metadata.size);
		}

		for (const [headerKey, headerValue] of Object.entries(headers)) {
			ctx.header(headerKey, headerValue);
		}

		return stream(ctx, async (streamWriter) => {
			for await (const chunk of result.stream) {
				await streamWriter.write(chunk);
			}
		});
	});

	app.put('/:bucket/:key{.+}', async (ctx) => {
		const bucket = ctx.req.param('bucket');
		const key = ctx.req.param('key');
		const url = new URL(ctx.req.url);
		const s3Service = ctx.get('s3Service');

		const uploadId = url.searchParams.get('uploadId');
		const partNumber = url.searchParams.get('partNumber');

		if (uploadId && partNumber) {
			const body = ctx.req.raw.body;
			if (!body) {
				throw S3Errors.missingContentLength();
			}

			const buffer = await ctx.req.arrayBuffer();
			const result = await s3Service.uploadPart(bucket, key, uploadId, parseInt(partNumber, 10), Buffer.from(buffer));

			return ctx.body(null, 200, {
				ETag: result.etag,
			});
		}

		const copySource = ctx.req.header('x-amz-copy-source');
		if (copySource) {
			const sourcePath = copySource.startsWith('/') ? copySource.slice(1) : copySource;
			const [sourceBucket, ...sourceKeyParts] = sourcePath.split('/');
			const sourceKey = sourceKeyParts.join('/');

			if (!sourceBucket || !sourceKey) {
				throw S3Errors.invalidArgument('Invalid x-amz-copy-source');
			}

			const metadataDirective = ctx.req.header('x-amz-metadata-directive') as 'COPY' | 'REPLACE' | undefined;
			const contentType = ctx.req.header('content-type');
			const metadata = extractUserMetadata(ctx.req.raw.headers);

			const copyMetadata = metadataDirective === 'REPLACE' ? metadata : undefined;
			const copyContentType = metadataDirective === 'REPLACE' ? contentType : undefined;
			const result = await s3Service.copyObject(
				decodeURIComponent(sourceBucket),
				decodeURIComponent(sourceKey),
				bucket,
				key,
				{
					metadataDirective: metadataDirective ?? 'COPY',
					...(copyMetadata !== undefined && {metadata: copyMetadata}),
					...(copyContentType !== undefined && {contentType: copyContentType}),
				},
			);

			let xml = xmlHeader();
			xml += '<CopyObjectResult>\n';
			xml += `  ${xmlTag('ETag', result.etag)}\n`;
			xml += `  ${xmlTag('LastModified', formatISODate(result.lastModified))}\n`;
			xml += '</CopyObjectResult>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		const contentType = ctx.req.header('content-type') ?? 'application/octet-stream';
		const contentMd5 = ctx.req.header('content-md5');
		const metadata = extractUserMetadata(ctx.req.raw.headers);

		const buffer = await ctx.req.arrayBuffer();
		const result = await s3Service.putObject(bucket, key, Buffer.from(buffer), {
			contentType,
			...(contentMd5 !== undefined && {contentMd5}),
			metadata,
		});

		return ctx.body(null, 200, {
			ETag: result.etag,
		});
	});

	app.delete('/:bucket/:key{.+}', async (ctx) => {
		const bucket = ctx.req.param('bucket');
		const key = ctx.req.param('key');
		const url = new URL(ctx.req.url);
		const s3Service = ctx.get('s3Service');

		const uploadId = url.searchParams.get('uploadId');
		if (uploadId) {
			await s3Service.abortMultipartUpload(bucket, key, uploadId);
			return ctx.body(null, 204);
		}

		await s3Service.deleteObject(bucket, key);
		return ctx.body(null, 204);
	});
}

function extractUserMetadata(headers: Headers): Record<string, string> {
	const metadata: Record<string, string> = {};

	headers.forEach((value, headerKey) => {
		const lowerKey = headerKey.toLowerCase();
		if (lowerKey.startsWith('x-amz-meta-')) {
			const metaKey = lowerKey.slice('x-amz-meta-'.length);
			metadata[metaKey] = value;
		}
	});

	return metadata;
}

function parseDeleteObjectsXml(xml: string): Array<string> {
	const keys: Array<string> = [];
	const regex = /<Key>([^<]+)<\/Key>/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(xml)) !== null) {
		keys.push(decodeXmlEntities(match[1]!));
	}

	return keys;
}

function parseCompleteMultipartUploadXml(xml: string): Array<{partNumber: number; etag: string}> {
	const parts: Array<{partNumber: number; etag: string}> = [];
	const partRegex = /<Part>\s*<PartNumber>(\d+)<\/PartNumber>\s*<ETag>([^<]+)<\/ETag>\s*<\/Part>/g;
	let match: RegExpExecArray | null;

	while ((match = partRegex.exec(xml)) !== null) {
		parts.push({
			partNumber: parseInt(match[1]!, 10),
			etag: decodeXmlEntities(match[2]!),
		});
	}

	return parts;
}

function decodeXmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}
