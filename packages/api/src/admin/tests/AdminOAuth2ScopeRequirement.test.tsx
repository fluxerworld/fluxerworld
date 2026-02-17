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
import {beforeEach, describe, test} from 'vitest';

interface OAuth2TokenResponse {
	token: string;
	user_id: string;
	scopes: Array<string>;
	application_id: string;
}

async function createOAuth2Token(
	harness: ApiTestHarness,
	userId: string,
	scopes: Array<string>,
): Promise<OAuth2TokenResponse> {
	return createBuilder<OAuth2TokenResponse>(harness, '')
		.post('/test/oauth2/access-token')
		.body({
			user_id: userId,
			scopes,
		})
		.execute();
}

describe('Admin OAuth2 Scope Requirement', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	describe('OAuth2 tokens WITHOUT admin scope', () => {
		test('OAuth2 token with only identify+email scopes CANNOT access admin endpoints even if user has admin ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();
		});

		test('OAuth2 token with identify+email+guilds scopes CANNOT access admin endpoints', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup', 'guild:lookup']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email', 'guilds']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/guilds/lookup')
				.body({
					guild_id: '123',
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();
		});

		test('OAuth2 token without admin scope CANNOT access audit logs endpoint', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'audit_log:view']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/audit-logs')
				.body({
					limit: 10,
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();
		});

		test('OAuth2 token without admin scope CANNOT access admin API keys endpoint', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.get('/admin/api-keys')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();
		});

		test('OAuth2 token with wildcard user ACL but no admin scope CANNOT access admin endpoints', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['*']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();
		});
	});

	describe('OAuth2 tokens WITH admin scope', () => {
		test('OAuth2 token with admin scope CAN access admin endpoints when user has proper ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('OAuth2 token with admin scope CAN access audit logs when user has proper ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'audit_log:view']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/audit-logs')
				.body({
					limit: 10,
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('OAuth2 token with admin scope CAN access admin API keys list when user has proper ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.get('/admin/api-keys')
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('OAuth2 token with admin scope still requires proper user ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
				.execute();
		});

		test('OAuth2 token with admin scope without admin:authenticate ACL cannot access admin endpoints', async () => {
			const user = await createTestAccount(harness);

			const oauth2Token = await createOAuth2Token(harness, user.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [user.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_PERMISSIONS')
				.execute();
		});
	});

	describe('Session tokens (no scope check needed)', () => {
		test('session token can access admin endpoints with proper ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('session token can access audit logs with proper ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'audit_log:view']);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.post('/admin/audit-logs')
				.body({
					limit: 10,
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('session token can access admin API keys with proper ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage']);

			await createBuilder(harness, `Bearer ${admin.token}`).get('/admin/api-keys').expect(HTTP_STATUS.OK).execute();
		});

		test('session token without admin:authenticate ACL cannot access admin endpoints', async () => {
			const user = await createTestAccount(harness);

			await createBuilder(harness, `Bearer ${user.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [user.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_PERMISSIONS')
				.execute();
		});
	});

	describe('Admin API keys (no scope check needed)', () => {
		test('admin API key can access endpoints with granted ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'user:lookup']);

			const apiKey = await createAdminApiKey(harness, admin, 'Test Key', ['user:lookup'], null);

			await createBuilder(harness, apiKey.token)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('admin API key can access audit logs with granted ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view']);

			const apiKey = await createAdminApiKey(harness, admin, 'Audit Key', ['audit_log:view'], null);

			await createBuilder(harness, apiKey.token)
				.post('/admin/audit-logs')
				.body({
					limit: 10,
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('admin API key without required ACL cannot access endpoint', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'audit_log:view']);

			const apiKey = await createAdminApiKey(harness, admin, 'Limited Key', ['audit_log:view'], null);

			await createBuilder(harness, apiKey.token)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
				.execute();
		});
	});

	describe('Edge cases', () => {
		test('OAuth2 token with only admin scope (no other scopes) CAN access admin endpoints', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('multiple admin endpoints require admin scope consistently', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup', 'guild:lookup', 'audit_log:view']);

			const tokenWithoutAdminScope = await createOAuth2Token(harness, admin.userId, ['identify', 'email']);

			await createBuilder(harness, `Bearer ${tokenWithoutAdminScope.token}`)
				.post('/admin/users/lookup')
				.body({user_ids: [admin.userId]})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();

			await createBuilder(harness, `Bearer ${tokenWithoutAdminScope.token}`)
				.post('/admin/guilds/lookup')
				.body({guild_id: '123'})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();

			await createBuilder(harness, `Bearer ${tokenWithoutAdminScope.token}`)
				.post('/admin/audit-logs')
				.body({limit: 10})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();
		});

		test('OAuth2 token with admin scope allows access to multiple admin endpoints', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup', 'guild:lookup', 'audit_log:view']);

			const tokenWithAdminScope = await createOAuth2Token(harness, admin.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${tokenWithAdminScope.token}`)
				.post('/admin/users/lookup')
				.body({user_ids: [admin.userId]})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder(harness, `Bearer ${tokenWithAdminScope.token}`)
				.post('/admin/guilds/lookup')
				.body({guild_id: '123'})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder(harness, `Bearer ${tokenWithAdminScope.token}`)
				.post('/admin/audit-logs')
				.body({limit: 10})
				.expect(HTTP_STATUS.OK)
				.execute();
		});
	});
});
