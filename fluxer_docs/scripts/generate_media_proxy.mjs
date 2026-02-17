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

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFrontmatter, escapeTableText, wrapCode, writeFile} from './shared.mjs';

const MEDIA_PROXY_BASE_URL = 'https://fluxerusercontent.com';

/**
 * Media proxy API endpoint URL helper.
 * Mintlify generates URLs from summary (slugified), not operationId.
 */
const MEDIA_PROXY_URLS = {
	getAvatar: '/media-proxy-api/images/get-user-or-guild-avatar',
	getIcon: '/media-proxy-api/images/get-guild-icon',
	getBanner: '/media-proxy-api/images/get-user-or-guild-banner',
	getEmoji: '/media-proxy-api/content/get-custom-emoji',
	getSticker: '/media-proxy-api/content/get-sticker',
	getAttachment: '/media-proxy-api/content/get-message-attachment',
	getExternalMedia: '/media-proxy-api/external/proxy-external-media',
	extractMetadata: '/media-proxy-api/internal/extract-media-metadata',
	generateThumbnail: '/media-proxy-api/internal/generate-video-thumbnail',
	extractFrames: '/media-proxy-api/internal/extract-video-frames',
};

const ENUMS = {
	ImageSizeEnum: [
		'16',
		'20',
		'22',
		'24',
		'28',
		'32',
		'40',
		'44',
		'48',
		'56',
		'60',
		'64',
		'80',
		'96',
		'100',
		'128',
		'160',
		'240',
		'256',
		'300',
		'320',
		'480',
		'512',
		'600',
		'640',
		'1024',
		'1280',
		'1536',
		'2048',
		'3072',
		'4096',
	],
	ImageFormatEnum: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
	ImageQualityEnum: ['high', 'low', 'lossless'],
};

const SCHEMAS = {
	ImageQueryParams: {
		description: 'Standard query parameters for image routes.',
		fields: [
			{
				name: 'size?',
				type: '[ImageSizeEnum](#imagesizeenum)',
				description: 'Target image size in pixels. Default: `128`',
			},
			{
				name: 'format?',
				type: '[ImageFormatEnum](#imageformatenum)',
				description: 'Output image format. Default: `webp`',
			},
			{
				name: 'quality?',
				type: '[ImageQualityEnum](#imagequalityenum)',
				description: 'Image quality level. Default: `high`',
			},
			{
				name: 'animated?',
				type: 'boolean',
				description: 'Whether to return animated images (GIF, APNG) if available. Default: `false`',
			},
		],
	},
	ExternalMediaQueryParams: {
		description: 'Query parameters for the external media proxy.',
		fields: [
			{
				name: 'width?',
				type: 'integer',
				description:
					'Target width in pixels (1-4096). If only width is specified, height is calculated to maintain aspect ratio.',
			},
			{
				name: 'height?',
				type: 'integer',
				description:
					'Target height in pixels (1-4096). If only height is specified, width is calculated to maintain aspect ratio.',
			},
			{
				name: 'format?',
				type: '[ImageFormatEnum](#imageformatenum)',
				description: 'Output image format. If not specified, the original format is preserved.',
			},
			{
				name: 'quality?',
				type: '[ImageQualityEnum](#imagequalityenum)',
				description: 'Image quality level. Default: `lossless`',
			},
			{
				name: 'animated?',
				type: 'boolean',
				description: 'Whether to preserve animation for GIF images. Default: `false`',
			},
		],
	},
	MetadataResponse: {
		description: 'Response from metadata extraction.',
		fields: [
			{name: 'format', type: 'string', description: 'Detected media format (e.g., `png`, `jpeg`, `gif`, `mp4`)'},
			{name: 'content_type', type: 'string', description: 'MIME content type'},
			{name: 'content_hash', type: 'string', description: 'SHA-256 hash of the content'},
			{name: 'size', type: 'integer', description: 'File size in bytes'},
			{name: 'width?', type: 'integer', description: 'Image or video width in pixels'},
			{name: 'height?', type: 'integer', description: 'Image or video height in pixels'},
			{name: 'duration?', type: 'number', description: 'Video or audio duration in seconds'},
			{name: 'placeholder?', type: 'string', description: 'BlurHash placeholder string for progressive loading'},
			{name: 'base64?', type: 'string', description: 'Base64-encoded content (if `with_base64` was requested)'},
			{name: 'animated?', type: 'boolean', description: 'Whether the image is animated (GIF, APNG)'},
			{name: 'nsfw', type: 'boolean', description: 'Whether the content was flagged as NSFW'},
			{name: 'nsfw_probability?', type: 'number', description: 'NSFW probability score (0-1)'},
			{name: 'nsfw_predictions?', type: 'map<string, number>', description: 'Per-category NSFW predictions'},
		],
	},
	MetadataRequestExternal: {
		description: 'Metadata request for external URLs.',
		fields: [
			{name: 'type', type: 'string', description: 'Must be `"external"`'},
			{name: 'url', type: 'string', description: 'External URL to fetch'},
			{name: 'with_base64?', type: 'boolean', description: 'Include base64-encoded content in response'},
			{name: 'isNSFWAllowed', type: 'boolean', description: 'Whether NSFW content is permitted'},
		],
	},
	MetadataRequestUpload: {
		description: 'Metadata request for uploaded files.',
		fields: [
			{name: 'type', type: 'string', description: 'Must be `"upload"`'},
			{name: 'upload_filename', type: 'string', description: 'Filename in the uploads bucket'},
			{name: 'isNSFWAllowed', type: 'boolean', description: 'Whether NSFW content is permitted'},
		],
	},
	MetadataRequestBase64: {
		description: 'Metadata request for base64-encoded data.',
		fields: [
			{name: 'type', type: 'string', description: 'Must be `"base64"`'},
			{name: 'base64', type: 'string', description: 'Base64-encoded media data'},
			{name: 'isNSFWAllowed', type: 'boolean', description: 'Whether NSFW content is permitted'},
		],
	},
	MetadataRequestS3: {
		description: 'Metadata request for S3 objects.',
		fields: [
			{name: 'type', type: 'string', description: 'Must be `"s3"`'},
			{name: 'bucket', type: 'string', description: 'S3 bucket name'},
			{name: 'key', type: 'string', description: 'S3 object key'},
			{name: 'with_base64?', type: 'boolean', description: 'Include base64-encoded content in response'},
			{name: 'isNSFWAllowed', type: 'boolean', description: 'Whether NSFW content is permitted'},
		],
	},
	ThumbnailRequestBody: {
		description: 'Request body for thumbnail generation.',
		fields: [
			{name: 'upload_filename', type: 'string', description: 'Filename of the uploaded video in the uploads bucket'},
		],
	},
	ThumbnailResponse: {
		description: 'Response from thumbnail generation.',
		fields: [
			{name: 'thumbnail', type: 'string', description: 'Base64-encoded thumbnail image (JPEG)'},
			{name: 'mime_type', type: 'string', description: 'MIME type of the thumbnail (always `image/jpeg`)'},
		],
	},
	FrameRequestUpload: {
		description: 'Frame extraction request for uploaded files.',
		fields: [
			{name: 'type', type: 'string', description: 'Must be `"upload"`'},
			{name: 'upload_filename', type: 'string', description: 'Filename in the uploads bucket'},
		],
	},
	FrameRequestS3: {
		description: 'Frame extraction request for S3 objects.',
		fields: [
			{name: 'type', type: 'string', description: 'Must be `"s3"`'},
			{name: 'bucket', type: 'string', description: 'S3 bucket name'},
			{name: 'key', type: 'string', description: 'S3 object key'},
		],
	},
	ExtractedFrame: {
		description: 'Single extracted video frame.',
		fields: [
			{name: 'timestamp', type: 'number', description: 'Frame timestamp in seconds'},
			{name: 'mime_type', type: 'string', description: 'MIME type of the frame image'},
			{name: 'base64', type: 'string', description: 'Base64-encoded frame image'},
		],
	},
	FrameResponse: {
		description: 'Response from frame extraction.',
		fields: [{name: 'frames', type: '[ExtractedFrame](#extractedframe)[]', description: 'Extracted video frames'}],
	},
};

function renderSchemaSection(name, schema) {
	let out = '';
	out += `<a id="${name.toLowerCase()}"></a>\n\n`;
	out += `## ${name}\n\n`;
	if (schema.description) {
		out += `${schema.description}\n\n`;
	}
	if (schema.relatedEndpoints) {
		out += '**Related endpoints**\n\n';
		for (const ep of schema.relatedEndpoints) {
			out += `- [\`${ep.method} ${ep.path}\`](${ep.href})\n`;
		}
		out += '\n';
	}
	if (schema.fields && schema.fields.length > 0) {
		out += '| Field | Type | Description |\n';
		out += '|-------|------|-------------|\n';
		for (const field of schema.fields) {
			out += `| ${escapeTableText(field.name)} | ${escapeTableText(field.type)} | ${escapeTableText(field.description)} |\n`;
		}
		out += '\n';
	}
	return out;
}

function renderEndpointsMdx() {
	let out = '';
	out += createFrontmatter({
		title: 'Media proxy',
		description: 'Object schemas used by the Fluxer media proxy.',
	});
	out += '\n\n';

	out += `The media proxy serves all user-generated content for Fluxer, including avatars, icons, attachments, emojis, stickers, and external media. All public routes are served from \`${MEDIA_PROXY_BASE_URL}\`.\n\n`;

	out += 'See the [Media Proxy API reference](/media-proxy-api) for the full list of available endpoints.\n\n';

	out += '## Field notation\n\n';
	out += 'Resource tables use a compact notation:\n\n';
	out += '| Notation | Meaning |\n';
	out += '|----------|----------|\n';
	out += '| `field` | Required field |\n';
	out += '| `field?` | Optional field (may be omitted) |\n';
	out += '| `?type` | Nullable (value can be `null`) |\n';
	out += '\n';

	out += '## Enums\n\n';

	out += '<a id="imagesizeenum"></a>\n\n';
	out += '### ImageSizeEnum\n\n';
	out += 'Allowed image sizes in pixels.\n\n';
	out += '**Related endpoints**\n\n';
	out += `- [\`GET /avatars/{id}/{filename}\`](${MEDIA_PROXY_URLS.getAvatar})\n`;
	out += `- [\`GET /icons/{id}/{filename}\`](${MEDIA_PROXY_URLS.getIcon})\n`;
	out += `- [\`GET /banners/{id}/{filename}\`](${MEDIA_PROXY_URLS.getBanner})\n`;
	out += `- [\`GET /emojis/{id}\`](${MEDIA_PROXY_URLS.getEmoji})\n`;
	out += `- [\`GET /stickers/{id}\`](${MEDIA_PROXY_URLS.getSticker})\n`;
	out += `- [\`GET /attachments/{channel_id}/{attachment_id}/{filename}\`](${MEDIA_PROXY_URLS.getAttachment})\n\n`;
	out += `| Value | Description |\n`;
	out += `|-------|-------------|\n`;
	for (const size of ENUMS.ImageSizeEnum) {
		out += `| ${wrapCode(size)} | ${size} pixels |\n`;
	}
	out += '\n';

	out += '<a id="imageformatenum"></a>\n\n';
	out += '### ImageFormatEnum\n\n';
	out += 'Allowed image output formats.\n\n';
	out += '**Related endpoints**\n\n';
	out += `- [\`GET /avatars/{id}/{filename}\`](${MEDIA_PROXY_URLS.getAvatar})\n`;
	out += `- [\`GET /external/{signature}/{timestamp}/{url}\`](${MEDIA_PROXY_URLS.getExternalMedia})\n\n`;
	out += `| Value | Description |\n`;
	out += `|-------|-------------|\n`;
	out += `| ${wrapCode('png')} | PNG format |\n`;
	out += `| ${wrapCode('jpg')} | JPEG format |\n`;
	out += `| ${wrapCode('jpeg')} | JPEG format (alias) |\n`;
	out += `| ${wrapCode('webp')} | WebP format (default, recommended) |\n`;
	out += `| ${wrapCode('gif')} | GIF format (for animated images) |\n`;
	out += '\n';

	out += '<a id="imagequalityenum"></a>\n\n';
	out += '### ImageQualityEnum\n\n';
	out += 'Image quality levels.\n\n';
	out += '**Related endpoints**\n\n';
	out += `- [\`GET /avatars/{id}/{filename}\`](${MEDIA_PROXY_URLS.getAvatar})\n`;
	out += `- [\`GET /external/{signature}/{timestamp}/{url}\`](${MEDIA_PROXY_URLS.getExternalMedia})\n\n`;
	out += '| Value | Description |\n';
	out += '|-------|-------------|\n';
	out += `| ${wrapCode('high')} | High quality compression, good balance of size and fidelity (default for most images) |\n`;
	out += `| ${wrapCode('low')} | Lower quality for smaller file sizes, suitable for thumbnails |\n`;
	out += `| ${wrapCode('lossless')} | No quality loss, largest file sizes (default for external media) |\n`;
	out += '\n';

	out += '---\n\n';
	out += '## Query parameter schemas\n\n';

	const querySchemas = ['ImageQueryParams', 'ExternalMediaQueryParams'];
	for (const name of querySchemas) {
		const schema = {...SCHEMAS[name]};
		schema.relatedEndpoints =
			name === 'ImageQueryParams'
				? [
						{method: 'GET', path: '/avatars/{id}/{filename}', href: MEDIA_PROXY_URLS.getAvatar},
						{method: 'GET', path: '/icons/{id}/{filename}', href: MEDIA_PROXY_URLS.getIcon},
						{method: 'GET', path: '/emojis/{id}', href: MEDIA_PROXY_URLS.getEmoji},
					]
				: [
						{
							method: 'GET',
							path: '/external/{signature}/{timestamp}/{url}',
							href: MEDIA_PROXY_URLS.getExternalMedia,
						},
					];
		out += renderSchemaSection(name, schema);
	}

	out += '---\n\n';
	out += '## Response schemas\n\n';

	const responseSchemas = ['MetadataResponse', 'ThumbnailResponse', 'FrameResponse', 'ExtractedFrame'];
	for (const name of responseSchemas) {
		const schema = {...SCHEMAS[name]};
		if (name === 'MetadataResponse') {
			schema.relatedEndpoints = [{method: 'POST', path: '/_metadata', href: MEDIA_PROXY_URLS.extractMetadata}];
		} else if (name === 'ThumbnailResponse') {
			schema.relatedEndpoints = [{method: 'POST', path: '/_thumbnail', href: MEDIA_PROXY_URLS.generateThumbnail}];
		} else if (name === 'FrameResponse') {
			schema.relatedEndpoints = [{method: 'POST', path: '/_frames', href: MEDIA_PROXY_URLS.extractFrames}];
		}
		out += renderSchemaSection(name, schema);
	}

	out += '---\n\n';
	out += '## Request schemas\n\n';

	out += '<a id="metadatarequest"></a>\n\n';
	out += '### MetadataRequest\n\n';
	out += 'Discriminated union for metadata extraction requests. The `type` field determines which variant is used.\n\n';
	out += '**Related endpoints**\n\n';
	out += `- [\`POST /_metadata\`](${MEDIA_PROXY_URLS.extractMetadata})\n\n`;
	out += '| Type | Description |\n';
	out += '|------|-------------|\n';
	out += '| [MetadataRequestExternal](#metadatarequestexternal) | Fetch metadata from an external URL |\n';
	out += '| [MetadataRequestUpload](#metadatarequestupload) | Get metadata from an uploaded file |\n';
	out += '| [MetadataRequestBase64](#metadatarequestbase64) | Get metadata from base64-encoded data |\n';
	out += '| [MetadataRequestS3](#metadatarequests3) | Get metadata from an S3 object |\n';
	out += '\n';

	const metadataRequestSchemas = [
		'MetadataRequestExternal',
		'MetadataRequestUpload',
		'MetadataRequestBase64',
		'MetadataRequestS3',
	];
	for (const name of metadataRequestSchemas) {
		out += renderSchemaSection(name, SCHEMAS[name]);
	}

	out += '<a id="framerequest"></a>\n\n';
	out += '### FrameRequest\n\n';
	out += 'Discriminated union for frame extraction requests. The `type` field determines which variant is used.\n\n';
	out += '**Related endpoints**\n\n';
	out += `- [\`POST /_frames\`](${MEDIA_PROXY_URLS.extractFrames})\n\n`;
	out += '| Type | Description |\n';
	out += '|------|-------------|\n';
	out += '| [FrameRequestUpload](#framerequestupload) | Extract frames from an uploaded file |\n';
	out += '| [FrameRequestS3](#framerequests3) | Extract frames from an S3 object |\n';
	out += '\n';

	const frameRequestSchemas = ['FrameRequestUpload', 'FrameRequestS3'];
	for (const name of frameRequestSchemas) {
		out += renderSchemaSection(name, SCHEMAS[name]);
	}

	out += renderSchemaSection('ThumbnailRequestBody', {
		...SCHEMAS.ThumbnailRequestBody,
		relatedEndpoints: [{method: 'POST', path: '/_thumbnail', href: MEDIA_PROXY_URLS.generateThumbnail}],
	});

	return out;
}

function generateOpenApiSpec() {
	const spec = {
		openapi: '3.1.0',
		info: {
			title: 'Fluxer Media Proxy API',
			version: '1.0.0',
			description:
				'Media proxy API for Fluxer. Serves avatars, icons, banners, attachments, emojis, stickers, and proxied external media.',
			contact: {
				name: 'Fluxer Developers',
				email: 'developers@fluxer.app',
			},
			license: {
				name: 'AGPL-3.0',
				url: 'https://www.gnu.org/licenses/agpl-3.0.html',
			},
		},
		servers: [
			{
				url: MEDIA_PROXY_BASE_URL,
				description: 'Production media proxy',
			},
		],
		tags: [
			{name: 'Images', description: 'User and guild images (avatars, icons, banners, splashes)'},
			{name: 'Content', description: 'Emojis, stickers, and attachments'},
			{name: 'External', description: 'Proxied external media'},
			{name: 'Themes', description: 'Theme CSS files'},
			{name: 'Internal', description: 'Internal endpoints for service-to-service communication'},
		],
		paths: {},
		components: {
			schemas: {
				ImageSizeEnum: {
					type: 'string',
					enum: ENUMS.ImageSizeEnum,
					description: 'Allowed image sizes in pixels',
					example: '128',
				},
				ImageFormatEnum: {
					type: 'string',
					enum: ENUMS.ImageFormatEnum,
					description: 'Allowed image output formats',
					example: 'webp',
				},
				ImageQualityEnum: {
					type: 'string',
					enum: ENUMS.ImageQualityEnum,
					description: 'Image quality levels: high (default), low (smaller files), lossless (no compression)',
					example: 'high',
				},
				MetadataRequestExternal: {
					type: 'object',
					description: 'Metadata request for external URLs',
					properties: {
						type: {type: 'string', const: 'external'},
						url: {type: 'string', format: 'uri', description: 'External URL to fetch'},
						with_base64: {type: 'boolean', description: 'Include base64-encoded content in response'},
						isNSFWAllowed: {type: 'boolean', description: 'Whether NSFW content is permitted'},
					},
					required: ['type', 'url', 'isNSFWAllowed'],
				},
				MetadataRequestUpload: {
					type: 'object',
					description: 'Metadata request for uploaded files',
					properties: {
						type: {type: 'string', const: 'upload'},
						upload_filename: {type: 'string', description: 'Filename in the uploads bucket'},
						isNSFWAllowed: {type: 'boolean', description: 'Whether NSFW content is permitted'},
					},
					required: ['type', 'upload_filename', 'isNSFWAllowed'],
				},
				MetadataRequestBase64: {
					type: 'object',
					description: 'Metadata request for base64-encoded data',
					properties: {
						type: {type: 'string', const: 'base64'},
						base64: {type: 'string', description: 'Base64-encoded media data'},
						isNSFWAllowed: {type: 'boolean', description: 'Whether NSFW content is permitted'},
					},
					required: ['type', 'base64', 'isNSFWAllowed'],
				},
				MetadataRequestS3: {
					type: 'object',
					description: 'Metadata request for S3 objects',
					properties: {
						type: {type: 'string', const: 's3'},
						bucket: {type: 'string', description: 'S3 bucket name'},
						key: {type: 'string', description: 'S3 object key'},
						with_base64: {type: 'boolean', description: 'Include base64-encoded content in response'},
						isNSFWAllowed: {type: 'boolean', description: 'Whether NSFW content is permitted'},
					},
					required: ['type', 'bucket', 'key', 'isNSFWAllowed'],
				},
				MetadataRequest: {
					oneOf: [
						{$ref: '#/components/schemas/MetadataRequestExternal'},
						{$ref: '#/components/schemas/MetadataRequestUpload'},
						{$ref: '#/components/schemas/MetadataRequestBase64'},
						{$ref: '#/components/schemas/MetadataRequestS3'},
					],
					discriminator: {
						propertyName: 'type',
						mapping: {
							external: '#/components/schemas/MetadataRequestExternal',
							upload: '#/components/schemas/MetadataRequestUpload',
							base64: '#/components/schemas/MetadataRequestBase64',
							s3: '#/components/schemas/MetadataRequestS3',
						},
					},
				},
				MetadataResponse: {
					type: 'object',
					description: 'Response from metadata extraction',
					properties: {
						format: {type: 'string', description: 'Detected media format (e.g., png, jpeg, gif, mp4)'},
						content_type: {type: 'string', description: 'MIME content type'},
						content_hash: {type: 'string', description: 'SHA-256 hash of content'},
						size: {type: 'integer', description: 'File size in bytes'},
						width: {type: 'integer', description: 'Image/video width in pixels'},
						height: {type: 'integer', description: 'Image/video height in pixels'},
						duration: {type: 'number', description: 'Video/audio duration in seconds'},
						placeholder: {type: 'string', description: 'BlurHash placeholder string'},
						base64: {type: 'string', description: 'Base64-encoded content (if requested)'},
						animated: {type: 'boolean', description: 'Whether the media is animated'},
						nsfw: {type: 'boolean', description: 'NSFW detection result'},
						nsfw_probability: {type: 'number', description: 'NSFW probability score (0-1)'},
						nsfw_predictions: {
							type: 'object',
							additionalProperties: {type: 'number'},
							description: 'Per-category NSFW predictions',
						},
					},
					required: ['format', 'content_type', 'content_hash', 'size', 'nsfw'],
				},
				ThumbnailRequestBody: {
					type: 'object',
					description: 'Request body for thumbnail generation',
					properties: {
						upload_filename: {type: 'string', description: 'Filename of the uploaded video'},
					},
					required: ['upload_filename'],
				},
				ThumbnailResponse: {
					type: 'object',
					description: 'Response from thumbnail generation',
					properties: {
						thumbnail: {type: 'string', description: 'Base64-encoded thumbnail image'},
						mime_type: {type: 'string', description: 'MIME type of thumbnail'},
					},
					required: ['thumbnail', 'mime_type'],
				},
				FrameRequestUpload: {
					type: 'object',
					description: 'Frame extraction request for uploaded files',
					properties: {
						type: {type: 'string', const: 'upload'},
						upload_filename: {type: 'string', description: 'Filename in the uploads bucket'},
					},
					required: ['type', 'upload_filename'],
				},
				FrameRequestS3: {
					type: 'object',
					description: 'Frame extraction request for S3 objects',
					properties: {
						type: {type: 'string', const: 's3'},
						bucket: {type: 'string', description: 'S3 bucket name'},
						key: {type: 'string', description: 'S3 object key'},
					},
					required: ['type', 'bucket', 'key'],
				},
				FrameRequest: {
					oneOf: [{$ref: '#/components/schemas/FrameRequestUpload'}, {$ref: '#/components/schemas/FrameRequestS3'}],
					discriminator: {
						propertyName: 'type',
						mapping: {
							upload: '#/components/schemas/FrameRequestUpload',
							s3: '#/components/schemas/FrameRequestS3',
						},
					},
				},
				ExtractedFrame: {
					type: 'object',
					description: 'Single extracted video frame',
					properties: {
						timestamp: {type: 'number', description: 'Frame timestamp in seconds'},
						mime_type: {type: 'string', description: 'MIME type of frame image'},
						base64: {type: 'string', description: 'Base64-encoded frame image'},
					},
					required: ['timestamp', 'mime_type', 'base64'],
				},
				FrameResponse: {
					type: 'object',
					description: 'Response from frame extraction',
					properties: {
						frames: {
							type: 'array',
							items: {$ref: '#/components/schemas/ExtractedFrame'},
							description: 'Extracted video frames',
						},
					},
					required: ['frames'],
				},
				Error: {
					type: 'object',
					description: 'Error response',
					properties: {
						error: {type: 'string', description: 'Error message'},
					},
				},
			},
			parameters: {
				sizeParam: {
					name: 'size',
					in: 'query',
					required: false,
					schema: {$ref: '#/components/schemas/ImageSizeEnum'},
					description: 'Target image size in pixels. Default: 128',
				},
				formatParam: {
					name: 'format',
					in: 'query',
					required: false,
					schema: {$ref: '#/components/schemas/ImageFormatEnum'},
					description: 'Output image format. Default: webp',
				},
				qualityParam: {
					name: 'quality',
					in: 'query',
					required: false,
					schema: {$ref: '#/components/schemas/ImageQualityEnum'},
					description: 'Image quality level. Default: high',
				},
				animatedParam: {
					name: 'animated',
					in: 'query',
					required: false,
					schema: {type: 'string', enum: ['true', 'false']},
					description: 'Whether to return animated images (GIF, APNG). Default: false',
				},
				widthParam: {
					name: 'width',
					in: 'query',
					required: false,
					schema: {type: 'integer', minimum: 1, maximum: 4096},
					description: 'Target width in pixels (1-4096)',
				},
				heightParam: {
					name: 'height',
					in: 'query',
					required: false,
					schema: {type: 'integer', minimum: 1, maximum: 4096},
					description: 'Target height in pixels (1-4096)',
				},
			},
			securitySchemes: {
				internalKey: {
					type: 'http',
					scheme: 'bearer',
					description: 'Internal service authentication using Bearer token',
				},
			},
		},
	};

	const binaryImageResponse = {
		200: {
			description: 'Image data',
			content: {
				'image/png': {schema: {type: 'string', format: 'binary'}},
				'image/jpeg': {schema: {type: 'string', format: 'binary'}},
				'image/webp': {schema: {type: 'string', format: 'binary'}},
				'image/gif': {schema: {type: 'string', format: 'binary'}},
			},
		},
		400: {description: 'Bad request - invalid parameters'},
		404: {description: 'Resource not found'},
	};

	const imageQueryParams = [
		{$ref: '#/components/parameters/sizeParam'},
		{$ref: '#/components/parameters/formatParam'},
		{$ref: '#/components/parameters/qualityParam'},
		{$ref: '#/components/parameters/animatedParam'},
	];

	const externalQueryParams = [
		{$ref: '#/components/parameters/widthParam'},
		{$ref: '#/components/parameters/heightParam'},
		{$ref: '#/components/parameters/formatParam'},
		{$ref: '#/components/parameters/qualityParam'},
		{$ref: '#/components/parameters/animatedParam'},
	];

	spec.paths['/avatars/{id}/{filename}'] = {
		get: {
			operationId: 'getAvatar',
			summary: 'Get user or guild avatar',
			description:
				'Retrieve a user or guild avatar image. Supports animated avatars (GIF) when the filename starts with `a_`.',
			tags: ['Images'],
			parameters: [
				{name: 'id', in: 'path', required: true, schema: {type: 'string'}, description: 'User or guild ID'},
				{
					name: 'filename',
					in: 'path',
					required: true,
					schema: {type: 'string'},
					description: 'Avatar filename (hash.ext or a_hash.ext for animated)',
				},
				...imageQueryParams,
			],
			responses: binaryImageResponse,
		},
	};

	spec.paths['/icons/{id}/{filename}'] = {
		get: {
			operationId: 'getIcon',
			summary: 'Get guild icon',
			description: 'Retrieve a guild icon image.',
			tags: ['Images'],
			parameters: [
				{name: 'id', in: 'path', required: true, schema: {type: 'string'}, description: 'Guild ID'},
				{name: 'filename', in: 'path', required: true, schema: {type: 'string'}, description: 'Icon filename'},
				...imageQueryParams,
			],
			responses: binaryImageResponse,
		},
	};

	spec.paths['/banners/{id}/{filename}'] = {
		get: {
			operationId: 'getBanner',
			summary: 'Get user or guild banner',
			description: 'Retrieve a user or guild banner image.',
			tags: ['Images'],
			parameters: [
				{name: 'id', in: 'path', required: true, schema: {type: 'string'}, description: 'User or guild ID'},
				{name: 'filename', in: 'path', required: true, schema: {type: 'string'}, description: 'Banner filename'},
				...imageQueryParams,
			],
			responses: binaryImageResponse,
		},
	};

	spec.paths['/splashes/{id}/{filename}'] = {
		get: {
			operationId: 'getSplash',
			summary: 'Get guild invite splash',
			description: 'Retrieve a guild invite splash image.',
			tags: ['Images'],
			parameters: [
				{name: 'id', in: 'path', required: true, schema: {type: 'string'}, description: 'Guild ID'},
				{name: 'filename', in: 'path', required: true, schema: {type: 'string'}, description: 'Splash filename'},
				...imageQueryParams,
			],
			responses: binaryImageResponse,
		},
	};

	spec.paths['/embed-splashes/{id}/{filename}'] = {
		get: {
			operationId: 'getEmbedSplash',
			summary: 'Get guild embed splash',
			description: 'Retrieve a guild embed splash image (used for server previews).',
			tags: ['Images'],
			parameters: [
				{name: 'id', in: 'path', required: true, schema: {type: 'string'}, description: 'Guild ID'},
				{
					name: 'filename',
					in: 'path',
					required: true,
					schema: {type: 'string'},
					description: 'Embed splash filename',
				},
				...imageQueryParams,
			],
			responses: binaryImageResponse,
		},
	};

	spec.paths['/emojis/{id}'] = {
		get: {
			operationId: 'getEmoji',
			summary: 'Get custom emoji',
			description: 'Retrieve a custom emoji image. May be PNG, GIF, or WebP.',
			tags: ['Content'],
			parameters: [
				{name: 'id', in: 'path', required: true, schema: {type: 'string'}, description: 'Emoji ID'},
				...imageQueryParams,
			],
			responses: binaryImageResponse,
		},
	};

	spec.paths['/stickers/{id}'] = {
		get: {
			operationId: 'getSticker',
			summary: 'Get sticker',
			description: 'Retrieve a sticker image or Lottie animation. May return PNG, APNG, GIF, or Lottie JSON.',
			tags: ['Content'],
			parameters: [
				{name: 'id', in: 'path', required: true, schema: {type: 'string'}, description: 'Sticker ID'},
				...imageQueryParams,
			],
			responses: {
				200: {
					description: 'Sticker data',
					content: {
						'image/png': {schema: {type: 'string', format: 'binary'}},
						'image/apng': {schema: {type: 'string', format: 'binary'}},
						'image/gif': {schema: {type: 'string', format: 'binary'}},
						'application/json': {schema: {type: 'object', description: 'Lottie animation JSON'}},
					},
				},
				404: {description: 'Sticker not found'},
			},
		},
	};

	spec.paths['/guilds/{guild_id}/users/{user_id}/avatars/{filename}'] = {
		get: {
			operationId: 'getGuildMemberAvatar',
			summary: 'Get guild member avatar',
			description: 'Retrieve a guild-specific member avatar.',
			tags: ['Images'],
			parameters: [
				{name: 'guild_id', in: 'path', required: true, schema: {type: 'string'}, description: 'Guild ID'},
				{name: 'user_id', in: 'path', required: true, schema: {type: 'string'}, description: 'User ID'},
				{name: 'filename', in: 'path', required: true, schema: {type: 'string'}, description: 'Avatar filename'},
				...imageQueryParams,
			],
			responses: binaryImageResponse,
		},
	};

	spec.paths['/guilds/{guild_id}/users/{user_id}/banners/{filename}'] = {
		get: {
			operationId: 'getGuildMemberBanner',
			summary: 'Get guild member banner',
			description: 'Retrieve a guild-specific member banner.',
			tags: ['Images'],
			parameters: [
				{name: 'guild_id', in: 'path', required: true, schema: {type: 'string'}, description: 'Guild ID'},
				{name: 'user_id', in: 'path', required: true, schema: {type: 'string'}, description: 'User ID'},
				{name: 'filename', in: 'path', required: true, schema: {type: 'string'}, description: 'Banner filename'},
				...imageQueryParams,
			],
			responses: binaryImageResponse,
		},
	};

	spec.paths['/attachments/{channel_id}/{attachment_id}/{filename}'] = {
		get: {
			operationId: 'getAttachment',
			summary: 'Get message attachment',
			description:
				'Retrieve a message attachment. Supports images, videos, and other files. Image query parameters only apply to image attachments.',
			tags: ['Content'],
			parameters: [
				{name: 'channel_id', in: 'path', required: true, schema: {type: 'string'}, description: 'Channel ID'},
				{name: 'attachment_id', in: 'path', required: true, schema: {type: 'string'}, description: 'Attachment ID'},
				{name: 'filename', in: 'path', required: true, schema: {type: 'string'}, description: 'Original filename'},
				...imageQueryParams,
			],
			responses: {
				200: {
					description: 'File data with appropriate Content-Type',
					content: {'*/*': {schema: {type: 'string', format: 'binary'}}},
				},
				404: {description: 'Attachment not found'},
			},
		},
	};

	spec.paths['/themes/{id}.css'] = {
		get: {
			operationId: 'getTheme',
			summary: 'Get theme CSS',
			description: 'Retrieve a theme CSS file.',
			tags: ['Themes'],
			parameters: [{name: 'id', in: 'path', required: true, schema: {type: 'string'}, description: 'Theme ID'}],
			responses: {
				200: {
					description: 'Theme CSS',
					content: {'text/css': {schema: {type: 'string'}}},
				},
				404: {description: 'Theme not found'},
			},
		},
	};

	spec.paths['/external/{signature}/{timestamp}/{url}'] = {
		get: {
			operationId: 'getExternalMedia',
			summary: 'Proxy external media',
			description:
				'Proxy external media through the Fluxer media proxy. External URLs are signed with HMAC-SHA256 to prevent abuse. The signature and timestamp parameters ensure URLs cannot be forged and expire after a configured period.',
			tags: ['External'],
			parameters: [
				{
					name: 'signature',
					in: 'path',
					required: true,
					schema: {type: 'string'},
					description: 'HMAC-SHA256 signature of the URL and timestamp, hex-encoded',
				},
				{
					name: 'timestamp',
					in: 'path',
					required: true,
					schema: {type: 'string'},
					description: 'Unix timestamp (seconds) when the signature was generated, hex-encoded',
				},
				{
					name: 'url',
					in: 'path',
					required: true,
					schema: {type: 'string'},
					description: 'External URL with protocol prefix (e.g., https/example.com/image.jpg)',
				},
				...externalQueryParams,
			],
			responses: {
				...binaryImageResponse,
				403: {description: 'Invalid signature or expired URL'},
				502: {description: 'Failed to fetch external resource'},
			},
		},
	};

	spec.paths['/_metadata'] = {
		post: {
			operationId: 'extractMetadata',
			summary: 'Extract media metadata',
			description:
				'Extract metadata from media files including dimensions, format, duration, NSFW detection, and optional base64 encoding.',
			tags: ['Internal'],
			security: [{internalKey: []}],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {$ref: '#/components/schemas/MetadataRequest'},
					},
				},
			},
			responses: {
				200: {
					description: 'Metadata extracted successfully',
					content: {
						'application/json': {
							schema: {$ref: '#/components/schemas/MetadataResponse'},
						},
					},
				},
				400: {description: 'Invalid request'},
				401: {description: 'Unauthorized'},
			},
		},
	};

	spec.paths['/_thumbnail'] = {
		post: {
			operationId: 'generateThumbnail',
			summary: 'Generate video thumbnail',
			description: 'Generate a thumbnail from a video file.',
			tags: ['Internal'],
			security: [{internalKey: []}],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {$ref: '#/components/schemas/ThumbnailRequestBody'},
					},
				},
			},
			responses: {
				200: {
					description: 'Thumbnail generated successfully',
					content: {
						'application/json': {
							schema: {$ref: '#/components/schemas/ThumbnailResponse'},
						},
					},
				},
				400: {description: 'Invalid request or unsupported video format'},
				401: {description: 'Unauthorized'},
			},
		},
	};

	spec.paths['/_frames'] = {
		post: {
			operationId: 'extractFrames',
			summary: 'Extract video frames',
			description: 'Extract multiple frames from a video file at evenly distributed timestamps.',
			tags: ['Internal'],
			security: [{internalKey: []}],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {$ref: '#/components/schemas/FrameRequest'},
					},
				},
			},
			responses: {
				200: {
					description: 'Frames extracted successfully',
					content: {
						'application/json': {
							schema: {$ref: '#/components/schemas/FrameResponse'},
						},
					},
				},
				400: {description: 'Invalid request or unsupported video format'},
				401: {description: 'Unauthorized'},
			},
		},
	};

	return spec;
}

async function main() {
	const dirname = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(dirname, '../..');

	const resourcesMdx = renderEndpointsMdx();
	await writeFile(path.join(repoRoot, 'fluxer_docs/resources/media_proxy.mdx'), resourcesMdx);

	const openApiSpec = generateOpenApiSpec();
	await writeFile(
		path.join(repoRoot, 'fluxer_docs/media-proxy-api/openapi.json'),
		JSON.stringify(openApiSpec, null, '\t'),
	);

	console.log('Generated media proxy documentation');
	console.log('  - fluxer_docs/resources/media_proxy.mdx');
	console.log('  - fluxer_docs/media-proxy-api/openapi.json');
}

await main();
