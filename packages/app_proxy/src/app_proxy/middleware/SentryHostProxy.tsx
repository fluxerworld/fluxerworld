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

import {normalizeHost} from '@fluxer/app_proxy/src/app_proxy/utils/Host';
import type {Context, Next} from 'hono';

interface SentryHostProxyMiddlewareOptions {
	sentryHost: string;
	// biome-ignore lint/suspicious/noConfusingVoidType: hono middleware may return void
	rateLimitMiddleware: (c: Context, next: Next) => Promise<Response | undefined | void>;
	proxyHandler: (c: Context) => Promise<Response>;
}

export function createSentryHostProxyMiddleware(options: SentryHostProxyMiddlewareOptions) {
	const {proxyHandler, rateLimitMiddleware, sentryHost} = options;

	return async function sentryHostProxy(c: Context, next: Next): Promise<Response | undefined> {
		const incomingHost = normalizeHost(c.req.raw.headers.get('host') ?? '');
		if (incomingHost && incomingHost === sentryHost) {
			const result = await rateLimitMiddleware(c, async () => {
				c.res = await proxyHandler(c);
			});
			if (result) {
				return result;
			}
			return c.res;
		}

		await next();
		return undefined;
	};
}
