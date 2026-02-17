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

import {SnowflakeTypeRef} from '@fluxer/openapi/src/converters/BuiltInSchemas';
import type {OpenAPIParameter} from '@fluxer/openapi/src/Types';

export const COMMON_PATH_PARAMETERS: Record<string, OpenAPIParameter> = {
	guild_id: {
		name: 'guild_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the guild',
	},
	channel_id: {
		name: 'channel_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the channel',
	},
	user_id: {
		name: 'user_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the user',
	},
	message_id: {
		name: 'message_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the message',
	},
	role_id: {
		name: 'role_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the role',
	},
	emoji_id: {
		name: 'emoji_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the emoji',
	},
	sticker_id: {
		name: 'sticker_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the sticker',
	},
	invite_code: {
		name: 'invite_code',
		in: 'path',
		required: true,
		schema: {type: 'string'},
		description: 'The invite code',
	},
	webhook_id: {
		name: 'webhook_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the webhook',
	},
	webhook_token: {
		name: 'webhook_token',
		in: 'path',
		required: true,
		schema: {type: 'string'},
		description: 'The webhook token',
	},
	pack_id: {
		name: 'pack_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the pack',
	},
	application_id: {
		name: 'application_id',
		in: 'path',
		required: true,
		schema: SnowflakeTypeRef,
		description: 'The ID of the OAuth2 application',
	},
};

export const COMMON_QUERY_PARAMETERS: Record<string, OpenAPIParameter> = {
	limit: {
		name: 'limit',
		in: 'query',
		required: false,
		schema: {type: 'integer', minimum: 1, maximum: 100, default: 50},
		description: 'Maximum number of results to return',
	},
	before: {
		name: 'before',
		in: 'query',
		required: false,
		schema: SnowflakeTypeRef,
		description: 'Get results before this ID',
	},
	after: {
		name: 'after',
		in: 'query',
		required: false,
		schema: SnowflakeTypeRef,
		description: 'Get results after this ID',
	},
	around: {
		name: 'around',
		in: 'query',
		required: false,
		schema: SnowflakeTypeRef,
		description: 'Get results around this ID',
	},
};

export function extractPathParameters(path: string): Array<OpenAPIParameter> {
	const paramRegex = /:(\w+)/g;
	const parameters: Array<OpenAPIParameter> = [];
	let match: RegExpExecArray | null;

	while ((match = paramRegex.exec(path)) !== null) {
		const paramName = match[1];
		const commonParam = COMMON_PATH_PARAMETERS[paramName];

		if (commonParam) {
			parameters.push({...commonParam});
		} else {
			parameters.push({
				name: paramName,
				in: 'path',
				required: true,
				schema: {type: 'string'},
				description: `The ${paramName.replace(/_/g, ' ')}`,
			});
		}
	}

	return parameters;
}

export function convertPathToOpenAPI(path: string): string {
	return path.replace(/:(\w+)/g, '{$1}');
}
