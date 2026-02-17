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

import {createAdminApiKey} from '@fluxer/api/src/admin/tests/AdminTestUtils';
import {createTestAccount, setUserACLs} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeEach, describe, expect, test} from 'vitest';

describe('Admin API Key Authorization', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('key can access endpoints with granted ACLs', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view', 'user:lookup']);

		const apiKey = await createAdminApiKey(harness, admin, 'Test Key', ['audit_log:view', 'user:lookup'], null);

		await createBuilder(harness, apiKey.token)
			.post('/admin/audit-logs')
			.body({
				limit: 10,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		await createBuilder(harness, apiKey.token)
			.post('/admin/users/lookup')
			.body({
				user_ids: [admin.userId],
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('key fails if owner loses admin access', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'user:lookup']);

		const apiKey = await createAdminApiKey(harness, admin, 'Owner Check', ['user:lookup'], null);
		await setUserACLs(harness, admin, ['admin_api_key:manage', 'user:lookup']);

		await createBuilder(harness, apiKey.token)
			.post('/admin/users/lookup')
			.body({
				user_ids: [admin.userId],
			})
			.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_PERMISSIONS')
			.execute();
	});

	test('key fails if owner loses required ACL', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'user:lookup']);

		const apiKey = await createAdminApiKey(harness, admin, 'Owner ACL Check', ['user:lookup'], null);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage']);

		await createBuilder(harness, apiKey.token)
			.post('/admin/users/lookup')
			.body({
				user_ids: [admin.userId],
			})
			.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
			.execute();
	});

	test('key cannot access endpoints without required ACLs', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view', 'user:lookup']);

		const apiKey = await createAdminApiKey(harness, admin, 'Limited Key', ['audit_log:view'], null);

		await createBuilder(harness, apiKey.token)
			.post('/admin/users/lookup')
			.body({
				user_ids: [admin.userId],
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('key with wildcard can access all endpoints', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['*']);

		const apiKey = await createAdminApiKey(harness, admin, 'Wildcard Key', ['*'], null);

		await createBuilder(harness, apiKey.token)
			.post('/admin/users/lookup')
			.body({
				user_ids: [admin.userId],
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('multiple keys with different ACLs work independently', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, [
			'admin:authenticate',
			'admin_api_key:manage',
			'audit_log:view',
			'user:lookup',
			'guild:lookup',
		]);

		const key1 = await createAdminApiKey(harness, admin, 'Audit Log Key', ['audit_log:view'], null);
		const key2 = await createAdminApiKey(harness, admin, 'Users Key', ['user:lookup'], null);
		const key3 = await createAdminApiKey(harness, admin, 'Guilds Key', ['guild:lookup'], null);

		await createBuilder(harness, key1.token)
			.post('/admin/audit-logs')
			.body({
				limit: 10,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		await createBuilder(harness, key2.token)
			.post('/admin/users/lookup')
			.body({
				user_ids: [admin.userId],
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const guildJson = await createBuilder<{guild: unknown}>(harness, key3.token)
			.post('/admin/guilds/lookup')
			.body({
				guild_id: '123',
			})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(guildJson.guild).toBeNull();

		await createBuilder(harness, key1.token)
			.post('/admin/users/lookup')
			.body({
				user_ids: [admin.userId],
			})
			.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
			.execute();
	});

	test('GET /admin/api-keys requires admin_api_key:manage', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage']);

		const apiKey = await createAdminApiKey(harness, admin, 'List Test', ['admin_api_key:manage'], null);

		await createBuilder(harness, apiKey.token).get('/admin/api-keys').expect(HTTP_STATUS.OK).execute();
	});

	test('GET /admin/api-keys fails without admin_api_key:manage', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage']);

		const apiKey = await createAdminApiKey(harness, admin, 'List Test No ACL', [], null);

		await createBuilder(harness, apiKey.token).get('/admin/api-keys').expect(HTTP_STATUS.FORBIDDEN).execute();
	});

	test('DELETE /admin/api-keys/:keyId requires admin_api_key:manage', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage']);

		const keyToDelete = await createAdminApiKey(harness, admin, 'To Delete', [], null);
		const deleterKey = await createAdminApiKey(harness, admin, 'Deleter', ['admin_api_key:manage'], null);

		await createBuilder(harness, deleterKey.token)
			.delete(`/admin/api-keys/${keyToDelete.keyId}`)
			.body(null)
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('DELETE /admin/api-keys/:keyId fails without admin_api_key:manage', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage']);

		const keyToDelete = await createAdminApiKey(harness, admin, 'To Delete 2', [], null);
		const deleterKey = await createAdminApiKey(harness, admin, 'Deleter No ACL', [], null);

		await createBuilder(harness, deleterKey.token)
			.delete(`/admin/api-keys/${keyToDelete.keyId}`)
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
});
