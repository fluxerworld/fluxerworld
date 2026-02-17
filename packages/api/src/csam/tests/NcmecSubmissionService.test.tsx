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
import {Config} from '@fluxer/api/src/Config';
import {
	getChannel,
	sendChannelMessage,
	setupTestGuildWithMembers,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import type {NcmecSubmissionStatusResponse, NcmecSubmitResult} from '@fluxer/api/src/csam/NcmecSubmissionService';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {CATEGORY_CHILD_SAFETY} from '@fluxer/constants/src/ReportCategories';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface ReportResponse {
	report_id: string;
	status: string;
	reported_at: string;
}

async function createAdminWithNcmecAccess(harness: ApiTestHarness): Promise<TestAccount> {
	const admin = await createTestAccount(harness);
	return setUserACLs(harness, admin, ['admin:authenticate', 'report:view', 'report:resolve', 'csam:submit_ncmec']);
}

async function createAdminWithViewOnly(harness: ApiTestHarness): Promise<TestAccount> {
	const admin = await createTestAccount(harness);
	return setUserACLs(harness, admin, ['admin:authenticate', 'report:view']);
}

async function createChildSafetyMessageReport(harness: ApiTestHarness): Promise<{reportId: string; token: string}> {
	const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
	const targetUser = members[0]!;

	await ensureSessionStarted(harness, targetUser.token);
	const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
	const message = await sendChannelMessage(harness, targetUser.token, channel.id, 'Test message for CSAM report');

	const report = await createBuilder<ReportResponse>(harness, owner.token)
		.post('/reports/message')
		.body({
			channel_id: channel.id,
			message_id: message.id,
			category: CATEGORY_CHILD_SAFETY,
			additional_info: 'Child safety report for testing',
		})
		.expect(HTTP_STATUS.OK)
		.execute();

	return {reportId: report.report_id, token: owner.token};
}

async function createNonChildSafetyReport(harness: ApiTestHarness): Promise<{reportId: string; token: string}> {
	const reporter = await createTestAccount(harness);
	const targetUser = await createTestAccount(harness);

	const report = await createBuilder<ReportResponse>(harness, reporter.token)
		.post('/reports/user')
		.body({
			user_id: targetUser.userId,
			category: 'harassment',
			additional_info: 'Harassment report for testing',
		})
		.expect(HTTP_STATUS.OK)
		.execute();

	return {reportId: report.report_id, token: reporter.token};
}

describe('NCMEC Submission Admin Endpoints', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('GET /admin/reports/:report_id/ncmec-status', () => {
		test('returns not_submitted for new child_safety report', async () => {
			const admin = await createAdminWithViewOnly(harness);
			const {reportId} = await createChildSafetyMessageReport(harness);

			const status = await createBuilder<NcmecSubmissionStatusResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/ncmec-status`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(status.status).toBe('not_submitted');
			expect(status.ncmec_report_id).toBeNull();
			expect(status.submitted_at).toBeNull();
			expect(status.submitted_by_admin_id).toBeNull();
			expect(status.failure_reason).toBeNull();
		});

		test('requires admin authentication', async () => {
			const {reportId} = await createChildSafetyMessageReport(harness);

			const {response} = await createBuilder(harness, '')
				.get(`/admin/reports/${reportId}/ncmec-status`)
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
		});

		test('requires report:view ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate']);
			const {reportId} = await createChildSafetyMessageReport(harness);

			const {response} = await createBuilder(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/ncmec-status`)
				.expect(HTTP_STATUS.FORBIDDEN)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
		});

		test('returns error for non-existent report', async () => {
			const admin = await createAdminWithViewOnly(harness);
			const nonExistentReportId = '999999999999999999';

			const {response} = await createBuilder(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${nonExistentReportId}/ncmec-status`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
		});

		test('returns error for non-child-safety report', async () => {
			const admin = await createAdminWithViewOnly(harness);
			const {reportId} = await createNonChildSafetyReport(harness);

			const {response} = await createBuilder(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/ncmec-status`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
		});
	});

	describe('POST /admin/reports/:report_id/ncmec-submit', () => {
		let originalNcmecConfig: {
			enabled: boolean;
			baseUrl?: string;
			username?: string;
			password?: string;
		};

		beforeEach(() => {
			originalNcmecConfig = {
				enabled: Config.ncmec.enabled,
				baseUrl: Config.ncmec.baseUrl,
				username: Config.ncmec.username,
				password: Config.ncmec.password,
			};

			Config.ncmec.enabled = true;
			Config.ncmec.baseUrl = 'https://exttest.cybertip.org/ispws';
			Config.ncmec.username = 'usr123';
			Config.ncmec.password = 'pswd123';
		});

		afterEach(() => {
			Config.ncmec.enabled = originalNcmecConfig.enabled;
			Config.ncmec.baseUrl = originalNcmecConfig.baseUrl;
			Config.ncmec.username = originalNcmecConfig.username;
			Config.ncmec.password = originalNcmecConfig.password;
		});

		test('successfully submits child_safety report to NCMEC', async () => {
			const admin = await createAdminWithNcmecAccess(harness);
			const {reportId} = await createChildSafetyMessageReport(harness);

			const result = await createBuilder<NcmecSubmitResult>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.success).toBe(true);
			expect(result.ncmec_report_id).toMatch(/^\d+$/);
			expect(result.error).toBeNull();
		});

		test('status changes to submitted after successful submission', async () => {
			const admin = await createAdminWithNcmecAccess(harness);
			const {reportId} = await createChildSafetyMessageReport(harness);

			await createBuilder<NcmecSubmitResult>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.OK)
				.execute();

			const status = await createBuilder<NcmecSubmissionStatusResponse>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${reportId}/ncmec-status`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(status.status).toBe('submitted');
			expect(status.ncmec_report_id).toMatch(/^\d+$/);
			expect(status.submitted_at).toBeTruthy();
			expect(status.submitted_by_admin_id).toBe(admin.userId);
		});

		test('requires admin authentication', async () => {
			const {reportId} = await createChildSafetyMessageReport(harness);

			const {response} = await createBuilder(harness, '')
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
		});

		test('requires csam:submit_ncmec ACL', async () => {
			const admin = await createAdminWithViewOnly(harness);
			const {reportId} = await createChildSafetyMessageReport(harness);

			const {response} = await createBuilder(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.FORBIDDEN)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
		});

		test('returns error for non-existent report', async () => {
			const admin = await createAdminWithNcmecAccess(harness);
			const nonExistentReportId = '999999999999999999';

			const {response} = await createBuilder(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${nonExistentReportId}/ncmec-submit`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
		});

		test('returns error for non-child-safety report', async () => {
			const admin = await createAdminWithNcmecAccess(harness);
			const {reportId} = await createNonChildSafetyReport(harness);

			const {response} = await createBuilder(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
		});

		test('returns error when already submitted', async () => {
			const admin = await createAdminWithNcmecAccess(harness);
			const {reportId} = await createChildSafetyMessageReport(harness);

			await createBuilder<NcmecSubmitResult>(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.OK)
				.execute();

			const {response} = await createBuilder(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.CONFLICT)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.CONFLICT);
		});
	});

	describe('Authorization Boundary Tests', () => {
		test('regular user cannot access ncmec-status endpoint', async () => {
			const user = await createTestAccount(harness);
			const {reportId} = await createChildSafetyMessageReport(harness);

			const {response} = await createBuilder(harness, user.token)
				.get(`/admin/reports/${reportId}/ncmec-status`)
				.expect(HTTP_STATUS.FORBIDDEN)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
		});

		test('regular user cannot access ncmec-submit endpoint', async () => {
			const user = await createTestAccount(harness);
			const {reportId} = await createChildSafetyMessageReport(harness);

			const {response} = await createBuilder(harness, user.token)
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.FORBIDDEN)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
		});

		test('admin with only report:view cannot submit', async () => {
			const admin = await createAdminWithViewOnly(harness);
			const {reportId} = await createChildSafetyMessageReport(harness);

			const {response} = await createBuilder(harness, `Bearer ${admin.token}`)
				.post(`/admin/reports/${reportId}/ncmec-submit`)
				.expect(HTTP_STATUS.FORBIDDEN)
				.executeWithResponse();

			expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
		});
	});
});
