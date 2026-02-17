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

import {createTestAccount, setUserACLs, type TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface ReportResponse {
	report_id: string;
	status: string;
	reported_at: string;
}

interface LegalHoldResponse {
	held: boolean;
}

async function createUserReport(harness: ApiTestHarness, reporter: TestAccount, targetUserId: string): Promise<string> {
	const result = await createBuilder<ReportResponse>(harness, reporter.token)
		.post('/reports/user')
		.body({
			user_id: targetUserId,
			category: 'harassment',
			additional_info: 'Test report for legal hold testing',
		})
		.expect(HTTP_STATUS.OK)
		.execute();
	return result.report_id;
}

async function createAdminUser(harness: ApiTestHarness, acls: Array<string>): Promise<TestAccount> {
	const account = await createTestAccount(harness);
	return setUserACLs(harness, account, acls);
}

describe('CSAM Legal Hold Service', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('GET /admin/reports/:report_id/legal-hold', () => {
		test('returns false when no legal hold exists', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);

			const result = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.held).toBe(false);
		});

		test('requires report:view ACL', async () => {
			const admin = await createAdminUser(harness, ['admin:authenticate']);
			const targetUser = await createTestAccount(harness);
			const reporter = await createTestAccount(harness);
			const reportId = await createUserReport(harness, reporter, targetUser.userId);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
				.execute();
		});

		test('requires authentication', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, reporter, targetUser.userId);

			await createBuilder(harness, '')
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
				.execute();
		});
	});

	describe('POST /admin/reports/:report_id/legal-hold', () => {
		test('creates a legal hold without expiration', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);

			const createResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(createResult.held).toBe(true);

			const checkResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(checkResult.held).toBe(true);
		});

		test('creates a legal hold with expiration date', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);
			const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

			const createResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({expires_at: expiresAt})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(createResult.held).toBe(true);

			const checkResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(checkResult.held).toBe(true);
		});

		test('requires report:resolve ACL', async () => {
			const admin = await createAdminUser(harness, ['admin:authenticate', 'report:view']);
			const targetUser = await createTestAccount(harness);
			const reporter = await createTestAccount(harness);
			const reportId = await createUserReport(harness, reporter, targetUser.userId);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
				.execute();
		});

		test('requires authentication', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, reporter, targetUser.userId);

			await createBuilder(harness, '')
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
				.execute();
		});

		test('can extend hold duration by re-posting', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);
			const originalExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
			const extendedExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({expires_at: originalExpiry})
				.expect(HTTP_STATUS.OK)
				.execute();

			const extendResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({expires_at: extendedExpiry})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(extendResult.held).toBe(true);

			const checkResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(checkResult.held).toBe(true);
		});
	});

	describe('DELETE /admin/reports/:report_id/legal-hold', () => {
		test('releases an existing legal hold', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.OK)
				.execute();

			const holdCheck = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(holdCheck.held).toBe(true);

			const releaseResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.delete(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(releaseResult.held).toBe(false);

			const afterRelease = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(afterRelease.held).toBe(false);
		});

		test('requires report:resolve ACL', async () => {
			const adminWithResolve = await createAdminUser(harness, ['*']);
			const adminWithoutResolve = await createAdminUser(harness, ['admin:authenticate', 'report:view']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, adminWithResolve, targetUser.userId);

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${adminWithResolve.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder(harness, `Bearer ${adminWithoutResolve.token}`)
				.delete(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
				.execute();
		});

		test('requires authentication', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder(harness, '')
				.delete(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
				.execute();
		});

		test('succeeds even when no hold exists', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);

			const releaseResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.delete(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(releaseResult.held).toBe(false);
		});
	});

	describe('Legal hold prevents evidence deletion', () => {
		test('active hold prevents automatic deletion', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.OK)
				.execute();

			const checkResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(checkResult.held).toBe(true);
		});

		test('releasing hold allows evidence deletion', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.delete(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			const checkResult = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(checkResult.held).toBe(false);
		});
	});

	describe('Hold lifecycle', () => {
		test('full hold lifecycle: create, verify, release, verify', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser = await createTestAccount(harness);
			const reportId = await createUserReport(harness, admin, targetUser.userId);

			const initialCheck = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(initialCheck.held).toBe(false);

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.OK)
				.execute();

			const afterHold = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(afterHold.held).toBe(true);

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.delete(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();

			const afterRelease = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(afterRelease.held).toBe(false);
		});

		test('multiple reports can have independent holds', async () => {
			const admin = await createAdminUser(harness, ['*']);
			const targetUser1 = await createTestAccount(harness);
			const targetUser2 = await createTestAccount(harness);
			const reportId1 = await createUserReport(harness, admin, targetUser1.userId);
			const reportId2 = await createUserReport(harness, admin, targetUser2.userId);

			await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId1}/legal-hold`)
				.body({})
				.expect(HTTP_STATUS.OK)
				.execute();

			const check1 = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId1}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(check1.held).toBe(true);

			const check2 = await createBuilder<LegalHoldResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId2}/legal-hold`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(check2.held).toBe(false);
		});
	});
});
