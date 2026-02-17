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

const BASE64_URL_PADDING_REGEX = /=*$/;
const LEGACY_PROTOCOL_REGEX = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const V2_PATH_PREFIX = 'v2/';

function encodeV2PathComponent(value: string): string {
	return Buffer.from(value, 'utf8').toString('base64url').replace(BASE64_URL_PADDING_REGEX, '');
}

function decodeV2PathComponent(value: string): string {
	return Buffer.from(value, 'base64url').toString('utf8');
}

function decodeLegacyComponent(component: string): string {
	return decodeURIComponent(component);
}

function getLegacyProtocolIndex(parts: Array<string>): number {
	const firstPart = parts[0];
	if (firstPart && LEGACY_PROTOCOL_REGEX.test(firstPart)) {
		return 0;
	}
	if (firstPart?.includes('%3D')) {
		return 1;
	}

	for (let index = 1; index < parts.length - 1; index += 1) {
		const part = parts[index];
		if (part && LEGACY_PROTOCOL_REGEX.test(part)) {
			return index;
		}
	}

	throw new Error('Protocol is missing in the proxy URL path.');
}

interface LegacyHostAndPort {
	hostname: string;
	port: string;
}

function decodeLegacyHostAndPort(hostPart: string): LegacyHostAndPort {
	const separatorIndex = hostPart.lastIndexOf(':');
	if (separatorIndex === -1) {
		const hostname = decodeLegacyComponent(hostPart);
		if (!hostname) {
			throw new Error('Hostname is invalid in the proxy URL path.');
		}
		return {hostname, port: ''};
	}

	const encodedHostname = hostPart.slice(0, separatorIndex);
	const encodedPort = hostPart.slice(separatorIndex + 1);
	if (!encodedHostname) {
		throw new Error('Hostname is invalid in the proxy URL path.');
	}

	return {
		hostname: decodeLegacyComponent(encodedHostname),
		port: encodedPort ? decodeLegacyComponent(encodedPort) : '',
	};
}

function reconstructLegacyOriginalUrl(proxyUrlPath: string): string {
	const parts = proxyUrlPath.split('/');
	const protocolIndex = getLegacyProtocolIndex(parts);
	const protocol = parts[protocolIndex];
	if (!protocol) {
		throw new Error('Protocol is missing in the proxy URL path.');
	}

	const hostPart = parts[protocolIndex + 1];
	if (!hostPart) {
		throw new Error('Hostname is missing in the proxy URL path.');
	}

	const encodedQuery = parts.slice(0, protocolIndex).join('/');
	const encodedPath = parts.slice(protocolIndex + 2).join('/');
	const query = encodedQuery ? decodeLegacyComponent(encodedQuery) : '';
	const path = decodeLegacyComponent(encodedPath);
	const {hostname, port} = decodeLegacyHostAndPort(hostPart);

	return `${protocol}://${hostname}${port ? `:${port}` : ''}/${path}${query ? `?${query}` : ''}`;
}

function reconstructV2OriginalUrl(proxyUrlPath: string): string {
	const encodedOriginalUrl = proxyUrlPath.slice(V2_PATH_PREFIX.length);
	if (!encodedOriginalUrl) {
		throw new Error('Encoded URL is missing in the proxy URL path.');
	}

	return decodeV2PathComponent(encodedOriginalUrl);
}

export function buildExternalMediaProxyPath(inputUrl: string): string {
	const parsedUrl = new URL(inputUrl);
	return `${V2_PATH_PREFIX}${encodeV2PathComponent(parsedUrl.toString())}`;
}

export function reconstructOriginalUrl(proxyUrlPath: string): string {
	const reconstructedUrl = proxyUrlPath.startsWith(V2_PATH_PREFIX)
		? reconstructV2OriginalUrl(proxyUrlPath)
		: reconstructLegacyOriginalUrl(proxyUrlPath);

	new URL(reconstructedUrl);
	return reconstructedUrl;
}
