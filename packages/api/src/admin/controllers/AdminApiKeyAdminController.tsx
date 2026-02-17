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

import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {
	CreateAdminApiKeyRequest,
	CreateAdminApiKeyResponse,
	type CreateAdminApiKeyResponse as CreateAdminApiKeyResponseType,
	DeleteApiKeyResponse,
	ListAdminApiKeyResponse,
	type ListAdminApiKeyResponse as ListAdminApiKeyResponseType,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {KeyIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {z} from 'zod';

export function AdminApiKeyAdminController(app: HonoApp) {
	app.post(
		'/admin/api-keys',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_CODE_GENERATION),
		requireAdminACL(AdminACLs.ADMIN_API_KEY_MANAGE),
		Validator('json', CreateAdminApiKeyRequest),
		OpenAPI({
			operationId: 'create_admin_api_key',
			summary: 'Create admin API key',
			responseSchema: CreateAdminApiKeyResponse,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				"Generates a new API key for administrative operations. The key is returned only once at creation time. Includes expiration settings and access control lists (ACLs) to limit the key's permissions.",
		}),
		async (ctx) => {
			const adminApiKeyService = ctx.get('adminApiKeyService');
			const user = ctx.get('user');
			const adminUserAcls = ctx.get('adminUserAcls');
			const request = ctx.req.valid('json');

			const result = await adminApiKeyService.createApiKey(request, user.id, adminUserAcls);

			const response: CreateAdminApiKeyResponseType = {
				key_id: result.apiKey.keyId,
				key: result.key,
				name: result.apiKey.name,
				created_at: result.apiKey.createdAt.toISOString(),
				expires_at: result.apiKey.expiresAt?.toISOString() ?? null,
				acls: Array.from(result.apiKey.acls),
			};

			return ctx.json(response);
		},
	);

	app.get(
		'/admin/api-keys',
		requireAdminACL(AdminACLs.ADMIN_API_KEY_MANAGE),
		OpenAPI({
			operationId: 'list_admin_api_keys',
			summary: 'List admin API keys',
			responseSchema: z.array(ListAdminApiKeyResponse),
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Retrieve all API keys created by the authenticated admin. Returns metadata including creation time, last used time, and assigned permissions. The actual key material is not returned.',
		}),
		async (ctx) => {
			const adminApiKeyService = ctx.get('adminApiKeyService');
			const user = ctx.get('user');

			const keys = await adminApiKeyService.listKeys(user.id);

			const response: Array<ListAdminApiKeyResponseType> = keys.map((key) => ({
				key_id: key.keyId,
				name: key.name,
				created_at: key.createdAt.toISOString(),
				last_used_at: key.lastUsedAt?.toISOString() ?? null,
				expires_at: key.expiresAt?.toISOString() ?? null,
				created_by_user_id: String(key.createdById),
				acls: Array.from(key.acls),
			}));

			return ctx.json(response);
		},
	);

	app.delete(
		'/admin/api-keys/:keyId',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_USER_MODIFY),
		requireAdminACL(AdminACLs.ADMIN_API_KEY_MANAGE),
		Validator('param', KeyIdParam),
		OpenAPI({
			operationId: 'delete_admin_api_key',
			summary: 'Delete admin API key',
			responseSchema: DeleteApiKeyResponse,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Revokes an API key, immediately invalidating it for all future operations. This action cannot be undone.',
		}),
		async (ctx) => {
			const adminApiKeyService = ctx.get('adminApiKeyService');
			const user = ctx.get('user');
			const keyId = ctx.req.valid('param').keyId;

			await adminApiKeyService.revokeKey(keyId, user.id);

			return ctx.json({success: true}, 200);
		},
	);
}
