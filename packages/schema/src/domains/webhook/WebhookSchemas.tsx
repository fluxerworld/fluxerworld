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

import {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const WebhookBaseResponse = {
	id: SnowflakeStringType.describe('The unique identifier (snowflake) for the webhook'),
	guild_id: SnowflakeStringType.describe('The ID of the guild this webhook belongs to'),
	channel_id: SnowflakeStringType.describe('The ID of the channel this webhook posts to'),
	name: z.string().describe('The display name of the webhook'),
	avatar: z.string().nullish().describe('The hash of the webhook avatar image'),
	token: z.string().describe('The secure token used to execute the webhook'),
};

export const WebhookTokenResponse = z.object(WebhookBaseResponse);
export type WebhookTokenResponse = z.infer<typeof WebhookTokenResponse>;

export const WebhookResponse = WebhookTokenResponse.extend({
	user: z.lazy(() => UserPartialResponse).describe('The user who created the webhook'),
});

export type WebhookResponse = z.infer<typeof WebhookResponse>;

export const WebhookListResponse = z.array(WebhookResponse).max(15).describe('A list of webhooks');
export type WebhookListResponse = z.infer<typeof WebhookListResponse>;

export interface Webhook {
	readonly id: string;
	readonly guild_id: string;
	readonly channel_id: string;
	readonly user: UserPartialResponse;
	readonly name: string;
	readonly avatar: string | null;
	readonly token: string;
}
