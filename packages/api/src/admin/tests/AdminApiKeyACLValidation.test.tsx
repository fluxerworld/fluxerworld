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

import {createAdminApiKey, listAdminApiKeys} from '@fluxer/api/src/admin/tests/AdminTestUtils';
import {createTestAccount, setUserACLs} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeEach, describe, expect, test} from 'vitest';

describe('Admin API Key ACL Validation', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('user cannot grant ACLs they do not have - grant only ACLs user has', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view']);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.post('/admin/api-keys')
			.body({
				name: 'Test Key',
				acls: ['audit_log:view'],
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('user cannot grant ACLs they do not have - grant ACL user does not have', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view']);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.post('/admin/api-keys')
			.body({
				name: 'Test Key',
				acls: ['audit_log:view', 'user:lookup'],
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('user with wildcard can grant any ACL', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['*']);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.post('/admin/api-keys')
			.body({
				name: 'Wildcard Test Key',
				acls: ['audit_log:view', 'user:lookup', 'guild:lookup', 'archive:trigger:user'],
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('must have admin_api_key:manage ACL to create keys', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'audit_log:view']);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.post('/admin/api-keys')
			.body({
				name: 'Test Key',
				acls: ['audit_log:view'],
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('ACLs are stored correctly', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, [
			'admin:authenticate',
			'admin_api_key:manage',
			'audit_log:view',
			'user:lookup',
			'guild:lookup',
		]);

		const requestedACLs = ['audit_log:view', 'user:lookup', 'guild:lookup'];

		await createAdminApiKey(harness, admin, 'ACL Storage Test', requestedACLs, null);

		const keys = await listAdminApiKeys(harness, admin.token);
		expect(keys).toHaveLength(1);

		const keyACLs = keys[0]!.acls as Array<string>;
		expect(keyACLs).toHaveLength(requestedACLs.length);
		expect(keyACLs).toEqual(expect.arrayContaining(requestedACLs));
	});

	test('cannot grant admin_api_key:manage without having it', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'audit_log:view', 'user:lookup']);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.post('/admin/api-keys')
			.body({
				name: 'Test Key',
				acls: ['audit_log:view', 'admin_api_key:manage'],
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('user with limited ACLs can create key with subset', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view', 'user:lookup']);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.post('/admin/api-keys')
			.body({
				name: 'Test Key',
				acls: ['audit_log:view'],
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('user with limited ACLs cannot create key with broader ACLs', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view']);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.post('/admin/api-keys')
			.body({
				name: 'Test Key',
				acls: ['audit_log:view', 'user:lookup'],
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('empty ACL list is valid', async () => {
		const admin = await createTestAccount(harness);
		await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view']);

		await createBuilder(harness, `Bearer ${admin.token}`)
			.post('/admin/api-keys')
			.body({
				name: 'Test Key',
				acls: [],
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});
});
