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

import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {GlobalSearchMessagesRequest} from '@fluxer/schema/src/domains/message/MessageRequestSchemas';
import {MessageSearchResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

export function SearchController(app: HonoApp) {
	app.post(
		'/search/messages',
		RateLimitMiddleware(RateLimitConfigs.SEARCH_MESSAGES),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'search_messages',
			summary: 'Search messages',
			description: 'Searches for messages across guilds and channels accessible to the authenticated user.',
			responseSchema: MessageSearchResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Search',
		}),
		Validator('json', GlobalSearchMessagesRequest),
		async (ctx) => {
			const params = ctx.req.valid('json');
			const userId = ctx.get('user').id;
			const requestCache = ctx.get('requestCache');
			const result = await ctx.get('searchService').searchMessages({userId, requestCache, data: params});
			return ctx.json(result);
		},
	);
}
