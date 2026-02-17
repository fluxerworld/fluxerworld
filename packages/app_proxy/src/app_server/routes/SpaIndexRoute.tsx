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

import type {CSPOptions} from '@fluxer/app_proxy/src/app_server/utils/CSP';
import {isStaticAsset} from '@fluxer/app_proxy/src/app_server/utils/Mime';
import {
	applySpaHeaders,
	serveSpaFallback,
	serveStaticFile,
} from '@fluxer/app_proxy/src/app_server/utils/StaticFileUtils';
import type {Logger} from '@fluxer/logger/src/Logger';
import type {Env, Hono} from 'hono';

export interface SpaIndexRouteOptions {
	staticDir: string;
	cspDirectives?: CSPOptions;
	logger: Logger;
}

export function createSpaIndexRoute<E extends Env>(app: Hono<E>, options: SpaIndexRouteOptions): void {
	const {cspDirectives, logger, staticDir} = options;

	app.get('*', (c) => {
		const requestPath = c.req.path;

		if (isStaticAsset(requestPath)) {
			const result = serveStaticFile({requestPath, resolvedStaticDir: staticDir, logger});
			if (!result.success) {
				if (result.error) {
					return c.text(result.error, 500);
				}
				return c.notFound();
			}
			return new Response(result.content, {
				headers: {
					'Content-Type': result.mimeType,
					'Cache-Control': result.cacheControl,
				},
			});
		}

		const fallbackResult = serveSpaFallback({resolvedStaticDir: staticDir, cspDirectives, logger});
		if (!fallbackResult.success) {
			return c.text(fallbackResult.error, 500);
		}

		applySpaHeaders(c, fallbackResult.csp);
		return c.body(fallbackResult.content);
	});
}
