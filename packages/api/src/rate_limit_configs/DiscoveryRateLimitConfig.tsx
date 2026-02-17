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

export const DiscoveryRateLimitConfigs = {
	DISCOVERY_SEARCH: {
		bucket: 'discovery:search',
		config: {limit: 30, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,

	DISCOVERY_CATEGORIES: {
		bucket: 'discovery:categories',
		config: {limit: 60, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,

	DISCOVERY_JOIN: {
		bucket: 'discovery:join',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,

	DISCOVERY_APPLY: {
		bucket: 'discovery:apply::guild_id',
		config: {limit: 5, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,

	DISCOVERY_STATUS: {
		bucket: 'discovery:status::guild_id',
		config: {limit: 30, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,

	DISCOVERY_ADMIN_LIST: {
		bucket: 'discovery:admin:list',
		config: {limit: 30, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,

	DISCOVERY_ADMIN_ACTION: {
		bucket: 'discovery:admin:action',
		config: {limit: 20, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
} as const;
