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

import {parseIpAddress} from '@fluxer/ip_utils/src/IpAddress';

export interface ClientIpExtractionOptions {
	trustCfConnectingIp?: boolean;
}

export type ClientIpSource = 'cf-connecting-ip' | 'x-forwarded-for';

export interface ExtractedClientIp {
	ip: string;
	source: ClientIpSource;
}

export interface HeadersLike {
	[key: string]: string | Array<string> | undefined;
}

export class MissingClientIpError extends Error {
	constructor() {
		super('X-Forwarded-For header is required');
		this.name = 'MissingClientIpError';
	}
}

interface HeaderReader {
	get(name: string): string | null;
}

function toStringHeaderValue(value: string | Array<string> | null | undefined): string | null {
	if (Array.isArray(value)) {
		const first = value[0];
		return typeof first === 'string' ? first : null;
	}
	return typeof value === 'string' ? value : null;
}

function parseSingleIpHeader(value: string | null): string | null {
	if (value === null) {
		return null;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}

	const parsed = parseIpAddress(trimmed);
	return parsed?.normalized ?? null;
}

function parseForwardedForHeader(value: string | null): string | null {
	if (value === null) {
		return null;
	}

	const [firstCandidate] = value.split(',', 1);
	if (!firstCandidate) {
		return null;
	}

	return parseSingleIpHeader(firstCandidate);
}

function createRequestHeaderReader(request: Request): HeaderReader {
	return {
		get: (name: string): string | null => {
			return request.headers.get(name);
		},
	};
}

function getHeaderValue(headers: HeadersLike, name: string): string | null {
	const lowerName = name.toLowerCase();
	const directMatch = toStringHeaderValue(headers[lowerName]);
	if (directMatch !== null) {
		return directMatch;
	}

	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === lowerName) {
			return toStringHeaderValue(value);
		}
	}

	return null;
}

function createNodeHeaderReader(headers: HeadersLike): HeaderReader {
	return {
		get: (name: string): string | null => {
			return getHeaderValue(headers, name);
		},
	};
}

function extractClientIpDetailsFromReader(
	headerReader: HeaderReader,
	options?: ClientIpExtractionOptions,
): ExtractedClientIp | null {
	if (options?.trustCfConnectingIp) {
		const cfConnectingIp = parseSingleIpHeader(headerReader.get('cf-connecting-ip'));
		if (cfConnectingIp) {
			return {
				ip: cfConnectingIp,
				source: 'cf-connecting-ip',
			};
		}
	}

	const xForwardedFor = parseForwardedForHeader(headerReader.get('x-forwarded-for'));
	if (xForwardedFor) {
		return {
			ip: xForwardedFor,
			source: 'x-forwarded-for',
		};
	}

	return null;
}

export function extractClientIpDetails(req: Request, options?: ClientIpExtractionOptions): ExtractedClientIp | null {
	return extractClientIpDetailsFromReader(createRequestHeaderReader(req), options);
}

export function extractClientIp(req: Request, options?: ClientIpExtractionOptions): string | null {
	const extracted = extractClientIpDetails(req, options);
	return extracted?.ip ?? null;
}

export function requireClientIp(req: Request, options?: ClientIpExtractionOptions): string {
	const ip = extractClientIp(req, options);
	if (!ip) {
		throw new MissingClientIpError();
	}
	return ip;
}

export function extractClientIpDetailsFromHeaders(
	headers: HeadersLike,
	options?: ClientIpExtractionOptions,
): ExtractedClientIp | null {
	return extractClientIpDetailsFromReader(createNodeHeaderReader(headers), options);
}

export function extractClientIpFromHeaders(headers: HeadersLike, options?: ClientIpExtractionOptions): string | null {
	const extracted = extractClientIpDetailsFromHeaders(headers, options);
	return extracted?.ip ?? null;
}
