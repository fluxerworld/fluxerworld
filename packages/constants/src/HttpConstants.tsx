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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const HttpStatus = {
	OK: 200,
	CREATED: 201,
	ACCEPTED: 202,
	NO_CONTENT: 204,
	PARTIAL_CONTENT: 206,

	MOVED_PERMANENTLY: 301,
	FOUND: 302,
	SEE_OTHER: 303,
	NOT_MODIFIED: 304,
	TEMPORARY_REDIRECT: 307,
	PERMANENT_REDIRECT: 308,

	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	NOT_ACCEPTABLE: 406,
	REQUEST_TIMEOUT: 408,
	CONFLICT: 409,
	GONE: 410,
	LENGTH_REQUIRED: 411,
	PRECONDITION_FAILED: 412,
	PAYLOAD_TOO_LARGE: 413,
	URI_TOO_LONG: 414,
	UNSUPPORTED_MEDIA_TYPE: 415,
	RANGE_NOT_SATISFIABLE: 416,
	TOO_MANY_REQUESTS: 429,

	INTERNAL_SERVER_ERROR: 500,
	NOT_IMPLEMENTED: 501,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusCode = ValueOf<typeof HttpStatus>;

export const MimeType = {
	JSON: 'application/json',
	XML: 'application/xml',
	FORM_URLENCODED: 'application/x-www-form-urlencoded',
	OCTET_STREAM: 'application/octet-stream',
	PDF: 'application/pdf',

	PLAIN: 'text/plain',
	HTML: 'text/html',
	CSS: 'text/css',
	JAVASCRIPT: 'text/javascript',
	CSV: 'text/csv',

	PNG: 'image/png',
	JPEG: 'image/jpeg',
	GIF: 'image/gif',
	WEBP: 'image/webp',
	SVG: 'image/svg+xml',
	ICO: 'image/x-icon',

	MP3: 'audio/mpeg',
	WAV: 'audio/wav',
	OGG_AUDIO: 'audio/ogg',

	MP4: 'video/mp4',
	WEBM: 'video/webm',
	OGG_VIDEO: 'video/ogg',

	MULTIPART_FORM_DATA: 'multipart/form-data',
} as const;

export type MimeTypeValue = ValueOf<typeof MimeType>;

export const HttpMethod = {
	GET: 'GET',
	POST: 'POST',
	PUT: 'PUT',
	PATCH: 'PATCH',
	DELETE: 'DELETE',
	HEAD: 'HEAD',
	OPTIONS: 'OPTIONS',
} as const;

export type HttpMethodValue = ValueOf<typeof HttpMethod>;

export const REDIRECT_STATUS_CODES = [
	HttpStatus.MOVED_PERMANENTLY,
	HttpStatus.FOUND,
	HttpStatus.SEE_OTHER,
	HttpStatus.TEMPORARY_REDIRECT,
	HttpStatus.PERMANENT_REDIRECT,
] as const;

export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number];
