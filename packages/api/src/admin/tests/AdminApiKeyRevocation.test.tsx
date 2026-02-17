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

import {createAdminApiKeyWithDefaultACLs, listAdminApiKeys} from '@fluxer/api/src/admin/tests/AdminTestUtils';
import {createTestAccount, setUserACLs} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeEach, describe, expect, test} from 'vitest';

async function hasAdminAPIKeyId(harness: ApiTestHarness, token: string, keyId: string): Promise<boolean> {
	const keys = await listAdminApiKeys(harness, token);
	return keys.some((k) => k.key_id === keyId);
}

describe('Admin API Key Revocation', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('basic revocation', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, [
			'admin:authenticate',
			'admin_api_key:manage',
			'audit_log:view',
			'user:lookup',
			'guild:lookup',
		]);

		const apiKey = await createAdminApiKeyWithDefaultACLs(harness, admin, 'Revoke Test');

		expect(await hasAdminAPIKeyId(harness, admin.token, apiKey.keyId)).toBe(true);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.delete(`/admin/api-keys/${apiKey.keyId}`)
			.body(null)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(await hasAdminAPIKeyId(harness, admin.token, apiKey.keyId)).toBe(false);
	});

	test('revocation by ID', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, [
			'admin:authenticate',
			'admin_api_key:manage',
			'audit_log:view',
			'user:lookup',
			'guild:lookup',
		]);

		const apiKey = await createAdminApiKeyWithDefaultACLs(harness, admin, 'ID Test');

		await createBuilder(harness, `Bearer ${admin.token}`)
			.delete(`/admin/api-keys/${apiKey.keyId}`)
			.body(null)
			.expect(HTTP_STATUS.OK)
			.execute();

		const keys = await listAdminApiKeys(harness, admin.token);
		expect(keys).toHaveLength(0);
	});

	test('revocation of non-existent key returns 404', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, [
			'admin:authenticate',
			'admin_api_key:manage',
			'audit_log:view',
			'user:lookup',
			'guild:lookup',
		]);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.delete('/admin/api-keys/nonexistent-id')
			.body(null)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('revocation requires admin_api_key:manage ACL', async () => {
		const admin1 = await createTestAccount(harness);
		const admin2 = await createTestAccount(harness);

		await setUserACLs(harness, admin1, [
			'admin:authenticate',
			'admin_api_key:manage',
			'audit_log:view',
			'user:lookup',
			'guild:lookup',
		]);
		await setUserACLs(harness, admin2, ['admin:authenticate']);

		const apiKey = await createAdminApiKeyWithDefaultACLs(harness, admin1, 'Admin1 Key');

		await createBuilder(harness, `Bearer ${admin2.token}`)
			.delete(`/admin/api-keys/${apiKey.keyId}`)
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();

		expect(await hasAdminAPIKeyId(harness, admin1.token, apiKey.keyId)).toBe(true);
	});

	test('cannot revoke other users keys', async () => {
		const admin1 = await createTestAccount(harness);
		const admin2 = await createTestAccount(harness);

		await setUserACLs(harness, admin1, [
			'admin:authenticate',
			'admin_api_key:manage',
			'audit_log:view',
			'user:lookup',
			'guild:lookup',
		]);
		await setUserACLs(harness, admin2, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view']);

		const apiKey = await createAdminApiKeyWithDefaultACLs(harness, admin1, 'Admin1 Key');

		await createBuilder(harness, `Bearer ${admin2.token}`)
			.delete(`/admin/api-keys/${apiKey.keyId}`)
			.body(null)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();

		expect(await hasAdminAPIKeyId(harness, admin1.token, apiKey.keyId)).toBe(true);
	});
});
