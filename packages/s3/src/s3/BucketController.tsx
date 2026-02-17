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

import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import {formatISODate, xmlHeader, xmlTag} from '@fluxer/s3/src/utils/XmlUtils';
import type {Hono} from 'hono';

export function BucketController(app: Hono<HonoEnv>) {
	app.get('/', async (ctx) => {
		const s3Service = ctx.get('s3Service');
		const buckets = await s3Service.listBuckets();

		let xml = xmlHeader();
		xml += '<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
		xml += '  <Owner>\n';
		xml += `    ${xmlTag('ID', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
		xml += `    ${xmlTag('DisplayName', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
		xml += '  </Owner>\n';
		xml += '  <Buckets>\n';

		for (const bucket of buckets) {
			xml += '    <Bucket>\n';
			xml += `      ${xmlTag('Name', bucket.name)}\n`;
			xml += `      ${xmlTag('CreationDate', formatISODate(bucket.creationDate))}\n`;
			xml += '    </Bucket>\n';
		}

		xml += '  </Buckets>\n';
		xml += '</ListAllMyBucketsResult>';

		return ctx.body(xml, 200, {
			'Content-Type': 'application/xml',
		});
	});

	app.put('/:bucket', async (ctx) => {
		const bucket = ctx.req.param('bucket');
		const s3Service = ctx.get('s3Service');

		await s3Service.createBucket(bucket);

		return ctx.body(null, 200, {
			Location: `/${bucket}`,
		});
	});

	app.delete('/:bucket', async (ctx) => {
		const bucket = ctx.req.param('bucket');
		const s3Service = ctx.get('s3Service');

		const url = new URL(ctx.req.url);
		if (url.searchParams.has('delete')) {
			return ctx.body(null, 200);
		}

		await s3Service.deleteBucket(bucket);
		return ctx.body(null, 204);
	});

	app.get('/:bucket', async (ctx) => {
		const bucket = ctx.req.param('bucket');
		const url = new URL(ctx.req.url);
		const s3Service = ctx.get('s3Service');

		if (ctx.req.method === 'HEAD') {
			await s3Service.headBucket(bucket);
			return ctx.body(null, 200);
		}

		if (url.searchParams.has('location')) {
			await s3Service.headBucket(bucket);

			let xml = xmlHeader();
			xml += '<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		if (url.searchParams.has('versioning')) {
			await s3Service.headBucket(bucket);

			let xml = xmlHeader();
			xml += '<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		if (url.searchParams.has('acl')) {
			await s3Service.headBucket(bucket);

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

		if (url.searchParams.has('cors')) {
			await s3Service.headBucket(bucket);

			let xml = xmlHeader();
			xml += '<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		if (url.searchParams.has('uploads')) {
			const prefix = url.searchParams.get('prefix') ?? undefined;
			const maxUploads = url.searchParams.get('max-uploads');

			const result = await s3Service.listMultipartUploads(bucket, {
				...(prefix !== undefined && {prefix}),
				...(maxUploads !== null && {maxUploads: parseInt(maxUploads, 10)}),
			});

			let xml = xmlHeader();
			xml += '<ListMultipartUploadsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
			xml += `  ${xmlTag('Bucket', bucket)}\n`;
			if (prefix) {
				xml += `  ${xmlTag('Prefix', prefix)}\n`;
			}
			xml += `  ${xmlTag('MaxUploads', maxUploads ?? '1000')}\n`;
			xml += `  ${xmlTag('IsTruncated', result.isTruncated)}\n`;

			for (const upload of result.uploads) {
				xml += '  <Upload>\n';
				xml += `    ${xmlTag('Key', upload.key)}\n`;
				xml += `    ${xmlTag('UploadId', upload.uploadId)}\n`;
				xml += '    <Initiator>\n';
				xml += `      ${xmlTag('ID', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
				xml += `      ${xmlTag('DisplayName', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
				xml += '    </Initiator>\n';
				xml += '    <Owner>\n';
				xml += `      ${xmlTag('ID', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
				xml += `      ${xmlTag('DisplayName', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
				xml += '    </Owner>\n';
				xml += '    <StorageClass>STANDARD</StorageClass>\n';
				xml += `    ${xmlTag('Initiated', formatISODate(upload.initiated))}\n`;
				xml += '  </Upload>\n';
			}

			xml += '</ListMultipartUploadsResult>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		const listType = url.searchParams.get('list-type');
		const prefix = url.searchParams.get('prefix') ?? undefined;
		const delimiter = url.searchParams.get('delimiter') ?? undefined;
		const maxKeys = url.searchParams.get('max-keys');
		const marker = url.searchParams.get('marker') ?? undefined;
		const startAfter = url.searchParams.get('start-after') ?? undefined;
		const continuationToken = url.searchParams.get('continuation-token') ?? undefined;
		const decodedContinuationToken = continuationToken
			? Buffer.from(continuationToken, 'base64').toString('utf-8')
			: undefined;

		const result = await s3Service.listObjects(bucket, {
			...(prefix !== undefined && {prefix}),
			...(delimiter !== undefined && {delimiter}),
			...(maxKeys !== null && {maxKeys: parseInt(maxKeys, 10)}),
			...(marker !== undefined && {marker}),
			...(startAfter !== undefined && {startAfter}),
			...(decodedContinuationToken !== undefined && {continuationToken: decodedContinuationToken}),
		});

		if (listType === '2') {
			let xml = xmlHeader();
			xml += '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
			xml += `  ${xmlTag('Name', bucket)}\n`;
			if (prefix) xml += `  ${xmlTag('Prefix', prefix)}\n`;
			if (delimiter) xml += `  ${xmlTag('Delimiter', delimiter)}\n`;
			xml += `  ${xmlTag('MaxKeys', maxKeys ?? '1000')}\n`;
			xml += `  ${xmlTag('KeyCount', result.keyCount)}\n`;
			xml += `  ${xmlTag('IsTruncated', result.isTruncated)}\n`;
			if (continuationToken) xml += `  ${xmlTag('ContinuationToken', continuationToken)}\n`;
			if (result.nextContinuationToken) {
				xml += `  ${xmlTag('NextContinuationToken', result.nextContinuationToken)}\n`;
			}
			if (startAfter) xml += `  ${xmlTag('StartAfter', startAfter)}\n`;

			for (const obj of result.contents) {
				xml += '  <Contents>\n';
				xml += `    ${xmlTag('Key', obj.key)}\n`;
				xml += `    ${xmlTag('LastModified', formatISODate(new Date(obj.lastModified)))}\n`;
				xml += `    ${xmlTag('ETag', obj.etag)}\n`;
				xml += `    ${xmlTag('Size', obj.size)}\n`;
				xml += '    <StorageClass>STANDARD</StorageClass>\n';
				xml += '  </Contents>\n';
			}

			for (const prefix of result.commonPrefixes) {
				xml += '  <CommonPrefixes>\n';
				xml += `    ${xmlTag('Prefix', prefix)}\n`;
				xml += '  </CommonPrefixes>\n';
			}

			xml += '</ListBucketResult>';

			return ctx.body(xml, 200, {
				'Content-Type': 'application/xml',
			});
		}

		let xml = xmlHeader();
		xml += '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
		xml += `  ${xmlTag('Name', bucket)}\n`;
		if (prefix) xml += `  ${xmlTag('Prefix', prefix)}\n`;
		if (marker) xml += `  ${xmlTag('Marker', marker)}\n`;
		if (delimiter) xml += `  ${xmlTag('Delimiter', delimiter)}\n`;
		xml += `  ${xmlTag('MaxKeys', maxKeys ?? '1000')}\n`;
		xml += `  ${xmlTag('IsTruncated', result.isTruncated)}\n`;
		if (result.nextMarker) xml += `  ${xmlTag('NextMarker', result.nextMarker)}\n`;

		for (const obj of result.contents) {
			xml += '  <Contents>\n';
			xml += `    ${xmlTag('Key', obj.key)}\n`;
			xml += `    ${xmlTag('LastModified', formatISODate(new Date(obj.lastModified)))}\n`;
			xml += `    ${xmlTag('ETag', obj.etag)}\n`;
			xml += `    ${xmlTag('Size', obj.size)}\n`;
			xml += '    <Owner>\n';
			xml += `      ${xmlTag('ID', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += `      ${xmlTag('DisplayName', ctx.get('accessKeyId') ?? 'anonymous')}\n`;
			xml += '    </Owner>\n';
			xml += '    <StorageClass>STANDARD</StorageClass>\n';
			xml += '  </Contents>\n';
		}

		for (const prefix of result.commonPrefixes) {
			xml += '  <CommonPrefixes>\n';
			xml += `    ${xmlTag('Prefix', prefix)}\n`;
			xml += '  </CommonPrefixes>\n';
		}

		xml += '</ListBucketResult>';

		return ctx.body(xml, 200, {
			'Content-Type': 'application/xml',
		});
	});
}
