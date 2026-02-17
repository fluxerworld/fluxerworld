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

import {resolve} from 'node:path';
import type {AppServerOptions, AppServerResult, HonoEnv} from '@fluxer/app_proxy/src/AppServerTypes';
import {applyAppServerMiddleware} from '@fluxer/app_proxy/src/app_server/AppServerMiddleware';
import {registerAppServerRoutes} from '@fluxer/app_proxy/src/app_server/AppServerRoutes';
import {Hono} from 'hono';

export function createAppServer(options: AppServerOptions): AppServerResult {
	const {assetVersion, captureException, cspDirectives, env, logger, staticDir, telemetry} = options;
	const resolvedStaticDir = resolve(staticDir);
	const app = new Hono<HonoEnv>({strict: true});

	applyAppServerMiddleware({
		app,
		captureException,
		env,
		logger,
		telemetry,
	});

	registerAppServerRoutes({
		app,
		assetVersion,
		cspDirectives,
		logger,
		staticDir: resolvedStaticDir,
	});

	const shutdown = () => {
		logger.info('shutting down app server');
	};

	return {app, shutdown};
}
