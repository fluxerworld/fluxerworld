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

import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Webhook} from '@fluxer/api/src/models/Webhook';
import {getCachedUserPartialResponse} from '@fluxer/api/src/user/UserCacheHelpers';
import type {WebhookResponse, WebhookTokenResponse} from '@fluxer/schema/src/domains/webhook/WebhookSchemas';
import type {z} from 'zod';

export function mapWebhookToTokenResponse(webhook: Webhook): z.infer<typeof WebhookTokenResponse> {
	return {
		id: webhook.id.toString(),
		guild_id: webhook.guildId?.toString() || '',
		channel_id: webhook.channelId?.toString() || '',
		name: webhook.name || '',
		avatar: webhook.avatarHash,
		token: webhook.token,
	};
}

export async function mapWebhookToResponseWithCache({
	webhook,
	userCacheService,
	requestCache,
}: {
	webhook: Webhook;
	userCacheService: UserCacheService;
	requestCache: RequestCache;
}): Promise<z.infer<typeof WebhookResponse>> {
	const creatorPartial = await getCachedUserPartialResponse({
		userId: webhook.creatorId!,
		userCacheService,
		requestCache,
	});
	if (!creatorPartial) {
		throw new Error(`Creator user ${webhook.creatorId} not found for webhook`);
	}
	return {
		...mapWebhookToTokenResponse(webhook),
		user: creatorPartial,
	};
}

export async function mapWebhooksToResponse({
	webhooks,
	userCacheService,
	requestCache,
}: {
	webhooks: Array<Webhook>;
	userCacheService: UserCacheService;
	requestCache: RequestCache;
}): Promise<Array<z.infer<typeof WebhookResponse>>> {
	return await Promise.all(
		webhooks.map((webhook) => mapWebhookToResponseWithCache({webhook, userCacheService, requestCache})),
	);
}
