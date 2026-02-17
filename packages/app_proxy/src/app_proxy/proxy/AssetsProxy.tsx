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

import {createProxyRequestHeaders, forwardProxyRequest} from '@fluxer/app_proxy/src/app_proxy/proxy/ProxyRequest';
import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import type {Logger} from '@fluxer/logger/src/Logger';
import type {Context} from 'hono';

export interface ProxyAssetsOptions {
	staticCDNEndpoint: string;
	logger: Logger;
}

export async function proxyAssets(c: Context, options: ProxyAssetsOptions): Promise<Response> {
	const {logger, staticCDNEndpoint} = options;
	const staticEndpoint = new URL(staticCDNEndpoint);
	const targetUrl = new URL(c.req.path, staticEndpoint);
	const headers = createProxyRequestHeaders({
		incomingHeaders: c.req.raw.headers,
		upstreamHost: staticEndpoint.host,
	});

	try {
		return await forwardProxyRequest({
			targetUrl,
			method: 'GET',
			headers,
		});
	} catch (error) {
		logger.error(
			{
				path: c.req.path,
				targetUrl: targetUrl.toString(),
				error,
			},
			'assets proxy error',
		);
		return c.text('Bad Gateway', HttpStatus.BAD_GATEWAY);
	}
}
