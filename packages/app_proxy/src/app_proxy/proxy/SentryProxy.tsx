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

import type {AppProxySentryProxyConfig} from '@fluxer/app_proxy/src/AppProxyTypes';
import {createProxyRequestHeaders, forwardProxyRequest} from '@fluxer/app_proxy/src/app_proxy/proxy/ProxyRequest';
import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import type {Logger} from '@fluxer/logger/src/Logger';
import type {Context} from 'hono';

export interface ProxySentryOptions {
	enabled: boolean;
	sentryProxy: AppProxySentryProxyConfig | null;
	sentryProxyPath: string;
	logger: Logger;
}

export async function proxySentry(c: Context, options: ProxySentryOptions): Promise<Response> {
	const {enabled, logger, sentryProxy, sentryProxyPath} = options;
	if (!enabled || !sentryProxy) {
		return c.text('Sentry proxy not configured', HttpStatus.SERVICE_UNAVAILABLE);
	}

	const targetPath = resolveSentryTargetPath(c.req.path, sentryProxyPath, sentryProxy.path_prefix);
	const targetUrl = new URL(targetPath, sentryProxy.target_url);
	const upstreamSentryEndpoint = new URL(sentryProxy.target_url);
	const headers = createProxyRequestHeaders({
		incomingHeaders: c.req.raw.headers,
		upstreamHost: upstreamSentryEndpoint.host,
	});

	try {
		return await forwardProxyRequest({
			targetUrl,
			method: c.req.method,
			headers,
			body: c.req.raw.body,
			bufferResponseBody: true,
		});
	} catch (error) {
		logger.error(
			{
				path: c.req.path,
				targetUrl: targetUrl.toString(),
				error,
			},
			'sentry proxy error',
		);
		return c.text('Bad Gateway', HttpStatus.BAD_GATEWAY);
	}
}

function resolveSentryTargetPath(requestPath: string, sentryProxyPath: string, sentryPathPrefix: string): string {
	let normalizedPath = requestPath;
	if (normalizedPath.startsWith(sentryProxyPath)) {
		normalizedPath = normalizedPath.slice(sentryProxyPath.length) || '/';
	}
	if (!normalizedPath.startsWith('/')) {
		normalizedPath = `/${normalizedPath}`;
	}
	return `${sentryPathPrefix}${normalizedPath}`;
}
