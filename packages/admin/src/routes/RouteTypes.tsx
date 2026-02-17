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

import type {AppContext, AppVariables} from '@fluxer/admin/src/types/App';
import type {AdminConfig} from '@fluxer/admin/src/types/Config';
import type {Hono, Next} from 'hono';

export type RequireAuthMiddleware = (c: AppContext, next: Next) => Promise<Response | undefined>;

export interface RouteFactoryDeps {
	config: AdminConfig;
	assetVersion: string;
	requireAuth: RequireAuthMiddleware;
}

export type RouteFactory = (deps: RouteFactoryDeps) => Hono<{Variables: AppVariables}>;
