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

import type {TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';

export interface AdminApiKey {
	keyId: string;
	key: string;
	name: string;
	acls: Array<string>;
	token: string;
}

export async function createAdminApiKey(
	harness: ApiTestHarness,
	account: TestAccount,
	name: string,
	acls: Array<string>,
	expiresInDays: number | null,
): Promise<AdminApiKey> {
	const data = await createBuilder<{key_id: string; key: string; name: string; acls: Array<string>}>(
		harness,
		`Bearer ${account.token}`,
	)
		.post('/admin/api-keys')
		.body({
			name,
			acls,
			...(expiresInDays !== null ? {expires_in_days: expiresInDays} : {}),
		})
		.execute();

	return {
		keyId: data.key_id,
		key: data.key,
		name: data.name,
		acls: data.acls,
		token: `Admin ${data.key}`,
	};
}

export async function createAdminApiKeyWithDefaultACLs(
	harness: ApiTestHarness,
	account: TestAccount,
	name: string,
): Promise<AdminApiKey> {
	return await createAdminApiKey(harness, account, name, ['audit_log:view', 'user:lookup', 'guild:lookup'], null);
}

export async function listAdminApiKeys(
	harness: ApiTestHarness,
	token: string,
): Promise<Array<Record<string, unknown>>> {
	return createBuilder<Array<Record<string, unknown>>>(harness, `Bearer ${token}`).get('/admin/api-keys').execute();
}

export async function revokeAdminApiKey(harness: ApiTestHarness, token: string, keyId: string): Promise<void> {
	await createBuilder<void>(harness, `Bearer ${token}`)
		.delete(`/admin/api-keys/${keyId}`)
		.body(null)
		.expect(200)
		.execute();
}

export async function setAdminUserAcls(
	harness: ApiTestHarness,
	adminToken: string,
	userId: string,
	acls: Array<string>,
): Promise<void> {
	await createBuilder<void>(harness, `Bearer ${adminToken}`)
		.post('/admin/users/set-acls')
		.body({
			user_id: userId,
			acls,
		})
		.execute();
}
