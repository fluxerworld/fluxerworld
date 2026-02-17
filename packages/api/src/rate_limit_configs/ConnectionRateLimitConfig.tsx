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

import type {RouteRateLimitConfig} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {ms} from 'itty-time';

export const ConnectionRateLimitConfigs = {
	CONNECTION_LIST: {
		bucket: 'connection:list',
		config: {limit: 60, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,

	CONNECTION_CREATE: {
		bucket: 'connection:create',
		config: {limit: 5, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,

	CONNECTION_UPDATE: {
		bucket: 'connection:update',
		config: {limit: 30, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,

	CONNECTION_DELETE: {
		bucket: 'connection:delete',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,

	CONNECTION_VERIFY: {
		bucket: 'connection:verify',
		config: {limit: 5, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,

	CONNECTION_VERIFY_AND_CREATE: {
		bucket: 'connection:verify_and_create',
		config: {limit: 5, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
} as const;
