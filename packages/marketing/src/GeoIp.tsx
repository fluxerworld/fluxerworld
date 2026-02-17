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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {extractClientIp} from '@fluxer/ip_utils/src/ClientIp';
import {readMarketingResponseAsText, sendMarketingRequest} from '@fluxer/marketing/src/MarketingHttpClient';
import {ms} from 'itty-time';

export interface GeoIpSettings {
	apiHost: string;
	rpcSecret: string;
}

const defaultCountryCode = 'US';

export async function getCountryCode(req: Request, settings: GeoIpSettings): Promise<string> {
	const ip = extractClientIp(req);
	if (!ip) return defaultCountryCode;

	const url = rpcUrl(settings.apiHost);
	if (!url) return defaultCountryCode;

	try {
		const response = await sendMarketingRequest({
			url,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${settings.rpcSecret}`,
			},
			body: JSON.stringify({type: 'geoip_lookup', ip}),
			timeout: ms('5 seconds'),
			serviceName: 'marketing_geoip',
		});

		if (response.status < 200 || response.status >= 300) return defaultCountryCode;
		const body = await readMarketingResponseAsText(response.stream);
		const code = decodeCountryCode(body);
		return code ?? defaultCountryCode;
	} catch {
		return defaultCountryCode;
	}
}

function decodeCountryCode(body: string): string | null {
	try {
		const parsed = JSON.parse(body) as {data?: {country_code?: string}};
		const code = parsed.data?.country_code;
		if (!code) return null;
		return code.trim().toUpperCase();
	} catch {
		return null;
	}
}

function rpcUrl(apiHost: string): string {
	const host = apiHost.trim();
	if (!host) return '';
	const base = host.includes('://') ? host : `http://${host}`;
	const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
	return `${normalized}/_rpc`;
}
