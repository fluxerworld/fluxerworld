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

import {MimeType} from '@fluxer/constants/src/HttpConstants';

export interface JsonResponseOptions {
	status: number;
	payload: Record<string, unknown>;
	headers?: Record<string, string>;
}

export interface JsonErrorResponseOptions {
	status: number;
	code: string;
	message: string;
	data?: Record<string, unknown>;
	headers?: Record<string, string>;
}

export function createJsonResponse(options: JsonResponseOptions): Response {
	return new Response(JSON.stringify(options.payload), {
		status: options.status,
		headers: {
			'Content-Type': MimeType.JSON,
			...(options.headers ?? {}),
		},
	});
}

export function createJsonErrorResponse(options: JsonErrorResponseOptions): Response {
	return createJsonResponse({
		status: options.status,
		payload: {
			code: options.code,
			message: options.message,
			...(options.data ?? {}),
		},
		headers: options.headers,
	});
}

export function createXmlErrorResponse(status: number, code: string, message: string): Response {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>${escapeXml(code)}</Code>
  <Message>${escapeXml(message)}</Message>
</Error>`;

	return new Response(xml, {
		status,
		headers: {
			'Content-Type': MimeType.XML,
		},
	});
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}
