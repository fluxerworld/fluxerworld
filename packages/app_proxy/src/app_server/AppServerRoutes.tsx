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

import type {HonoEnv} from '@fluxer/app_proxy/src/AppServerTypes';
import {createSpaIndexRoute} from '@fluxer/app_proxy/src/app_server/routes/SpaIndexRoute';
import {createSpaRoute} from '@fluxer/app_proxy/src/app_server/routes/SpaRoute';
import type {CSPOptions} from '@fluxer/app_proxy/src/app_server/utils/CSP';
import type {Logger} from '@fluxer/logger/src/Logger';
import type {Hono} from 'hono';

interface RegisterAppServerRoutesOptions {
	app: Hono<HonoEnv>;
	assetVersion?: string;
	cspDirectives?: CSPOptions;
	logger: Logger;
	staticDir: string;
}

export function registerAppServerRoutes(options: RegisterAppServerRoutesOptions): void {
	const {app, assetVersion, cspDirectives, logger, staticDir} = options;

	app.get('/_health', (c) => c.text('OK'));

	createSpaRoute(app, {
		staticDir,
		assetVersion,
	});

	createSpaIndexRoute(app, {
		staticDir,
		cspDirectives,
		logger,
	});
}
