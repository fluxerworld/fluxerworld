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
import {MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {z} from 'zod';

const UnfurlQuery = z.object({
	url: z.string().url().max(2048),
});

const UnfurlResponse = z.object({
	embeds: z.array(MessageEmbedResponse),
});

export function EmbedController(app: HonoApp): void {
	app.get(
		'/unfurl',
		RateLimitMiddleware(RateLimitConfigs.UNFURL),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'unfurl_url',
			summary: 'Resolve a URL into embed metadata for E2EE clients',
			responseSchema: UnfurlResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Embed'],
			description:
				'Runs a single URL through the server-side unfurler and returns the resulting embed objects. Intended for end-to-end encrypted clients that hold the plaintext locally: after decryption the client extracts URLs and calls this endpoint per URL so link previews (YouTube, KLIPY, Bluesky, generic OpenGraph) still render even though the server never sees the message body. Results are read from the shared url-embed cache when present.',
		}),
		Validator('query', UnfurlQuery),
		async (ctx) => {
			const {url} = ctx.req.valid('query');
			const embeds = await ctx.get('embedService').unfurlSingleUrl(url, false);
			return ctx.json({embeds});
		},
	);
}
