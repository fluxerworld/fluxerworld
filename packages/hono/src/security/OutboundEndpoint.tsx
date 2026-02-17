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

import {isIP} from 'node:net';

export interface ValidateOutboundEndpointOptions {
	name: string;
	allowHttp: boolean;
	allowLocalhost: boolean;
	allowPrivateIpLiterals: boolean;
}

export function validateOutboundEndpointUrl(rawEndpoint: string, options: ValidateOutboundEndpointOptions): URL {
	let endpointUrl: URL;
	try {
		endpointUrl = new URL(rawEndpoint);
	} catch {
		throw new Error(`${options.name} must be a valid URL`);
	}

	if (endpointUrl.protocol !== 'http:' && endpointUrl.protocol !== 'https:') {
		throw new Error(`${options.name} must use http or https`);
	}

	if (endpointUrl.protocol === 'http:' && !options.allowHttp) {
		throw new Error(`${options.name} must use https`);
	}

	if (endpointUrl.username || endpointUrl.password) {
		throw new Error(`${options.name} must not include URL credentials`);
	}

	if (endpointUrl.search || endpointUrl.hash) {
		throw new Error(`${options.name} must not include query string or fragment`);
	}

	const hostname = endpointUrl.hostname.toLowerCase();
	if (!hostname) {
		throw new Error(`${options.name} must include a hostname`);
	}

	if (!options.allowLocalhost && isLocalhostHostname(hostname)) {
		throw new Error(`${options.name} cannot use localhost`);
	}

	if (!options.allowPrivateIpLiterals && isPrivateOrSpecialIpLiteral(hostname)) {
		throw new Error(`${options.name} cannot use private or special IP literals`);
	}

	return endpointUrl;
}

export function normalizeEndpointOrigin(endpointUrl: URL): string {
	const pathname = endpointUrl.pathname.endsWith('/') ? endpointUrl.pathname.slice(0, -1) : endpointUrl.pathname;
	const normalisedPath = pathname === '/' ? '' : pathname;
	return `${endpointUrl.protocol}//${endpointUrl.host}${normalisedPath}`;
}

export function buildEndpointUrl(endpointUrl: URL, path: string): string {
	const trimmedPath = path.trim();
	if (!trimmedPath) {
		return normalizeEndpointOrigin(endpointUrl);
	}

	const lowercasePath = trimmedPath.toLowerCase();
	if (lowercasePath.startsWith('http://') || lowercasePath.startsWith('https://') || trimmedPath.startsWith('//')) {
		throw new Error('Outbound path must be relative');
	}

	const prefixedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
	return `${normalizeEndpointOrigin(endpointUrl)}${prefixedPath}`;
}

function isLocalhostHostname(hostname: string): boolean {
	return hostname === 'localhost' || hostname.endsWith('.localhost');
}

function isPrivateOrSpecialIpLiteral(hostname: string): boolean {
	const ipVersion = isIP(hostname);
	if (!ipVersion) {
		return false;
	}

	if (ipVersion === 4) {
		return isPrivateOrSpecialIPv4(hostname);
	}

	return isPrivateOrSpecialIPv6(hostname);
}

function isPrivateOrSpecialIPv4(hostname: string): boolean {
	const octets = hostname.split('.').map((part) => Number(part));
	if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
		return true;
	}

	const [first, second] = octets;
	if (first === 0 || first === 10 || first === 127) return true;
	if (first === 169 && second === 254) return true;
	if (first === 172 && second >= 16 && second <= 31) return true;
	if (first === 192 && second === 168) return true;
	if (first === 100 && second >= 64 && second <= 127) return true;
	if (first === 198 && (second === 18 || second === 19)) return true;
	if (first >= 224) return true;
	return false;
}

function isPrivateOrSpecialIPv6(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	if (lower === '::' || lower === '::1') {
		return true;
	}

	if (lower.startsWith('::ffff:')) {
		const mapped = lower.slice('::ffff:'.length);
		return isPrivateOrSpecialIPv4(mapped);
	}

	if (lower.startsWith('fe80:')) return true;
	if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
	if (lower.startsWith('ff')) return true;
	return false;
}
