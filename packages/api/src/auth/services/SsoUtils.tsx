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

import {Logger} from '@fluxer/api/src/Logger';
import * as FetchUtils from '@fluxer/api/src/utils/FetchUtils';
import {ms} from 'itty-time';

export interface DiscoveredOidcProviderMetadata {
	issuer: string;
	authorization_endpoint?: string;
	token_endpoint?: string;
	userinfo_endpoint?: string;
	jwks_uri?: string;
}

export function sanitizeSsoRedirectTo(redirectTo?: string): string | undefined {
	if (!redirectTo) return undefined;
	const trimmed = redirectTo.trim();
	if (!trimmed) return undefined;

	if (!trimmed.startsWith('/')) return undefined;
	if (trimmed.startsWith('//')) return undefined;
	if (trimmed.length > 2048) return undefined;
	if (trimmed.includes('\r') || trimmed.includes('\n')) return undefined;

	return trimmed;
}

export function parseTokenEndpointResponse(
	contentTypeHeader: string | null,
	rawResponseBody: string,
): {id_token?: string; access_token?: string} {
	const contentType = contentTypeHeader?.toLowerCase() ?? '';
	const raw = rawResponseBody;

	if (contentType.includes('application/json') || contentType.includes('application/jwt')) {
		try {
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			return {
				id_token: typeof parsed['id_token'] === 'string' ? parsed['id_token'] : undefined,
				access_token: typeof parsed['access_token'] === 'string' ? parsed['access_token'] : undefined,
			};
		} catch {
			return {id_token: undefined, access_token: undefined};
		}
	}

	const params = new URLSearchParams(raw);
	return {
		id_token: params.get('id_token') ?? undefined,
		access_token: params.get('access_token') ?? undefined,
	};
}

function buildDiscoveryUrl(issuer: string): URL {
	const issuerUrl = new URL(issuer);
	const normalized = issuerUrl.toString().replace(/\/$/, '');
	return new URL(`${normalized}/.well-known/openid-configuration`);
}

function normalizeIssuerForCompare(value: string): string {
	return value.replace(/\/$/, '');
}

export async function tryDiscoverOidcProviderMetadata(issuer: string): Promise<DiscoveredOidcProviderMetadata | null> {
	try {
		const url = buildDiscoveryUrl(issuer);
		const resp = await FetchUtils.sendRequest({
			url: url.toString(),
			method: 'GET',
			headers: {Accept: 'application/json'},
			timeout: ms('10 seconds'),
			serviceName: 'sso_oidc_discovery',
		});
		if (resp.status < 200 || resp.status >= 300) return null;

		const rawBody = await FetchUtils.streamToString(resp.stream);
		const json = JSON.parse(rawBody) as Record<string, unknown>;
		const discoveredIssuer = typeof json['issuer'] === 'string' ? json['issuer'] : null;
		if (!discoveredIssuer) return null;

		if (normalizeIssuerForCompare(discoveredIssuer) !== normalizeIssuerForCompare(issuer)) {
			return null;
		}

		return {
			issuer: discoveredIssuer,
			authorization_endpoint:
				typeof json['authorization_endpoint'] === 'string' ? json['authorization_endpoint'] : undefined,
			token_endpoint: typeof json['token_endpoint'] === 'string' ? json['token_endpoint'] : undefined,
			userinfo_endpoint: typeof json['userinfo_endpoint'] === 'string' ? json['userinfo_endpoint'] : undefined,
			jwks_uri: typeof json['jwks_uri'] === 'string' ? json['jwks_uri'] : undefined,
		};
	} catch (error) {
		Logger.debug({issuer, error}, 'Failed to discover OIDC provider metadata');
		return null;
	}
}
