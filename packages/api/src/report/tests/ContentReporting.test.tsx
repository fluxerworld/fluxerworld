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

import {
	clearTestEmails,
	createTestAccount,
	createUniqueEmail,
	findLastTestEmail,
	listTestEmails,
	setUserACLs,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	createDmChannel,
	createFriendship,
	createGuild,
	getChannel,
	sendChannelMessage,
	setupTestGuildWithMembers,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface ReportResponse {
	report_id: string;
	status: string;
	reported_at: string;
}

describe('Content Reporting', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('Report User', () => {
		test('should report a user with valid category', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'harassment',
					additional_info: 'User is harassing me in DMs',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
			expect(result.status).toBe('pending');
			expect(result.reported_at).toBeTruthy();
		});

		test('should report a user with spam category', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'spam_account',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
			expect(result.status).toBe('pending');
		});

		test('should report a user with guild context', async () => {
			const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
			const targetUser = members[0];

			const result = await createBuilder<ReportResponse>(harness, owner.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'harassment',
					additional_info: 'User is harassing members in guild',
					guild_id: guild.id,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('should reject report with invalid category', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			await createBuilder(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId.toString(),
					category: 'invalid_category',
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should reject report without authentication', async () => {
			const targetUser = await createTestAccount(harness);

			await createBuilderWithoutAuth(harness)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId.toString(),
					category: 'harassment',
				})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});

		test('should report user with impersonation category', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'impersonation',
					additional_info: 'User is impersonating a celebrity',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('admin report detail includes mutual DM channel when present', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'report:view']);

			await createFriendship(harness, reporter, targetUser);
			const mutualDm = await createDmChannel(harness, reporter.token, targetUser.userId);

			const report = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'harassment',
					additional_info: 'User is harassing me in DMs',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const reportDetail = await createBuilder<{
				report_id: string;
				mutual_dm_channel_id?: string | null;
			}>(harness, `Bearer ${admin.token}`)
				.get(`/admin/reports/${report.report_id}`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(reportDetail.report_id).toBe(report.report_id);
			expect(reportDetail.mutual_dm_channel_id).toBe(mutualDm.id);
		});
	});

	describe('Report Message', () => {
		test('should report a message with valid category', async () => {
			const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
			const targetUser = members[0];

			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const message = await sendChannelMessage(harness, targetUser.token, channel.id, 'Offensive content');

			const result = await createBuilder<ReportResponse>(harness, owner.token)
				.post('/reports/message')
				.body({
					channel_id: channel.id,
					message_id: message.id,
					category: 'harassment',
					additional_info: 'This message is harassing me',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
			expect(result.status).toBe('pending');
		});

		test('should report message with spam category', async () => {
			const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
			const targetUser = members[0];

			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const message = await sendChannelMessage(harness, targetUser.token, channel.id, 'Buy now! Click link!');

			const result = await createBuilder<ReportResponse>(harness, owner.token)
				.post('/reports/message')
				.body({
					channel_id: channel.id,
					message_id: message.id,
					category: 'spam',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('should report message with hate_speech category', async () => {
			const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
			const targetUser = members[0];

			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const message = await sendChannelMessage(harness, targetUser.token, channel.id, 'Test message');

			const result = await createBuilder<ReportResponse>(harness, owner.token)
				.post('/reports/message')
				.body({
					channel_id: channel.id,
					message_id: message.id,
					category: 'hate_speech',
					additional_info: 'Contains hate speech',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('should report message with illegal_activity category', async () => {
			const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
			const targetUser = members[0];

			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const message = await sendChannelMessage(harness, targetUser.token, channel.id, 'Test message');

			const result = await createBuilder<ReportResponse>(harness, owner.token)
				.post('/reports/message')
				.body({
					channel_id: channel.id,
					message_id: message.id,
					category: 'illegal_activity',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('should reject message report without authentication', async () => {
			const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
			const targetUser = members[0];

			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const message = await sendChannelMessage(harness, targetUser.token, channel.id, 'Test message');

			await createBuilderWithoutAuth(harness)
				.post('/reports/message')
				.body({
					channel_id: channel.id,
					message_id: message.id,
					category: 'harassment',
				})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});

	describe('Report Guild', () => {
		test('should report a guild with valid category', async () => {
			const reporter = await createTestAccount(harness);
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Problematic Guild');

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
					category: 'harassment',
					additional_info: 'Guild promotes harassment',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
			expect(result.status).toBe('pending');
		});

		test('should report guild with extremist_community category', async () => {
			const reporter = await createTestAccount(harness);
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Test Guild');

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
					category: 'extremist_community',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('should report guild with raid_coordination category', async () => {
			const reporter = await createTestAccount(harness);
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Test Guild');

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
					category: 'raid_coordination',
					additional_info: 'Guild is coordinating raids',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('should report guild with malware_distribution category', async () => {
			const reporter = await createTestAccount(harness);
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Test Guild');

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
					category: 'malware_distribution',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('should reject guild report with invalid category', async () => {
			const reporter = await createTestAccount(harness);
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Test Guild');

			await createBuilder(harness, reporter.token)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
					category: 'invalid_category',
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should reject guild report without authentication', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Test Guild');

			await createBuilderWithoutAuth(harness)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
					category: 'harassment',
				})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});

	describe('Report Validation', () => {
		test('should reject report with additional_info exceeding max length', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			const longInfo = 'a'.repeat(1001);

			await createBuilder(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId.toString(),
					category: 'harassment',
					additional_info: longInfo,
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should accept report with maximum length additional_info', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			const maxLengthInfo = 'a'.repeat(1000);

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'harassment',
					additional_info: maxLengthInfo,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});

		test('should accept report without additional_info', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			const result = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'spam_account',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
		});
	});

	describe('Report Requires Category', () => {
		test('should reject user report without category', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			await createBuilder(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId.toString(),
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should reject message report without category', async () => {
			const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
			const targetUser = members[0];

			await ensureSessionStarted(harness, targetUser.token);
			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const message = await sendChannelMessage(harness, targetUser.token, channel.id, 'Test message');

			await createBuilder(harness, owner.token)
				.post('/reports/message')
				.body({
					channel_id: channel.id,
					message_id: message.id,
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should reject guild report without category', async () => {
			const reporter = await createTestAccount(harness);
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Test Guild');

			await createBuilder(harness, reporter.token)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});
	});

	describe('Duplicate Reports', () => {
		test('should allow user to report same user multiple times', async () => {
			const reporter = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			const firstReport = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'harassment',
					additional_info: 'First report',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(firstReport.report_id).toBeTruthy();

			const secondReport = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'spam_account',
					additional_info: 'Second report with different category',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(secondReport.report_id).toBeTruthy();
			expect(secondReport.report_id).not.toBe(firstReport.report_id);
		});

		test('should allow user to report same message multiple times', async () => {
			const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
			const targetUser = members[0];

			await ensureSessionStarted(harness, targetUser.token);
			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const message = await sendChannelMessage(harness, targetUser.token, channel.id, 'Problematic message');

			const firstReport = await createBuilder<ReportResponse>(harness, owner.token)
				.post('/reports/message')
				.body({
					channel_id: channel.id,
					message_id: message.id,
					category: 'harassment',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(firstReport.report_id).toBeTruthy();

			const secondReport = await createBuilder<ReportResponse>(harness, owner.token)
				.post('/reports/message')
				.body({
					channel_id: channel.id,
					message_id: message.id,
					category: 'spam',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(secondReport.report_id).toBeTruthy();
			expect(secondReport.report_id).not.toBe(firstReport.report_id);
		});

		test('should allow user to report same guild multiple times', async () => {
			const reporter = await createTestAccount(harness);
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Problematic Guild');

			const firstReport = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
					category: 'harassment',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(firstReport.report_id).toBeTruthy();

			const secondReport = await createBuilder<ReportResponse>(harness, reporter.token)
				.post('/reports/guild')
				.body({
					guild_id: guild.id,
					category: 'extremist_community',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(secondReport.report_id).toBeTruthy();
			expect(secondReport.report_id).not.toBe(firstReport.report_id);
		});

		test('should allow different users to report same content', async () => {
			const reporter1 = await createTestAccount(harness);
			const reporter2 = await createTestAccount(harness);
			const targetUser = await createTestAccount(harness);

			const report1 = await createBuilder<ReportResponse>(harness, reporter1.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'harassment',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const report2 = await createBuilder<ReportResponse>(harness, reporter2.token)
				.post('/reports/user')
				.body({
					user_id: targetUser.userId,
					category: 'harassment',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(report1.report_id).toBeTruthy();
			expect(report2.report_id).toBeTruthy();
			expect(report1.report_id).not.toBe(report2.report_id);
		});
	});

	describe('DSA Report Flow', () => {
		test('should send DSA verification email', async () => {
			await clearTestEmails(harness);
			const email = createUniqueEmail('dsa-reporter');

			await createBuilderWithoutAuth(harness)
				.post('/reports/dsa/email/send')
				.body({email})
				.expect(HTTP_STATUS.OK)
				.execute();

			const emails = await listTestEmails(harness);
			const dsaEmail = findLastTestEmail(emails, 'dsa_report_verification');
			expect(dsaEmail).toBeTruthy();
			expect(dsaEmail!.to).toBe(email.toLowerCase());
			expect(dsaEmail!.metadata.code).toBeTruthy();
		});

		test('should verify DSA email and return ticket', async () => {
			await clearTestEmails(harness);
			const email = createUniqueEmail('dsa-reporter');

			await createBuilderWithoutAuth(harness).post('/reports/dsa/email/send').body({email}).execute();

			const emails = await listTestEmails(harness);
			const dsaEmail = findLastTestEmail(emails, 'dsa_report_verification');
			expect(dsaEmail).toBeTruthy();

			const code = dsaEmail!.metadata.code;

			const verifyResponse = await createBuilder<{ticket: string}>(harness, '')
				.post('/reports/dsa/email/verify')
				.body({email, code})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(verifyResponse.ticket).toBeTruthy();
			expect(verifyResponse.ticket.length).toBeGreaterThan(0);
		});

		test('should reject DSA email verification with invalid code', async () => {
			await clearTestEmails(harness);
			const email = createUniqueEmail('dsa-reporter');

			await createBuilderWithoutAuth(harness).post('/reports/dsa/email/send').body({email}).execute();

			await createBuilderWithoutAuth(harness)
				.post('/reports/dsa/email/verify')
				.body({email, code: 'XXXX-XXXX'})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should create DSA user report with valid ticket', async () => {
			await clearTestEmails(harness);
			const email = createUniqueEmail('dsa-reporter');
			const targetUser = await createTestAccount(harness);

			await createBuilderWithoutAuth(harness).post('/reports/dsa/email/send').body({email}).execute();

			const emails = await listTestEmails(harness);
			const dsaEmail = findLastTestEmail(emails, 'dsa_report_verification');
			const code = dsaEmail!.metadata.code;

			const verifyResponse = await createBuilder<{ticket: string}>(harness, '')
				.post('/reports/dsa/email/verify')
				.body({email, code})
				.expect(HTTP_STATUS.OK)
				.execute();

			const result = await createBuilder<ReportResponse>(harness, '')
				.post('/reports/dsa')
				.body({
					ticket: verifyResponse.ticket,
					report_type: 'user',
					category: 'harassment',
					user_id: targetUser.userId,
					reporter_full_legal_name: 'John Doe',
					reporter_country_of_residence: 'DE',
					additional_info: 'DSA report for harassment',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
			expect(result.status).toBe('pending');
		});

		test('should create DSA guild report with valid ticket', async () => {
			await clearTestEmails(harness);
			const email = createUniqueEmail('dsa-reporter');
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'DSA Test Guild');

			await createBuilderWithoutAuth(harness).post('/reports/dsa/email/send').body({email}).execute();

			const emails = await listTestEmails(harness);
			const dsaEmail = findLastTestEmail(emails, 'dsa_report_verification');
			const code = dsaEmail!.metadata.code;

			const verifyResponse = await createBuilder<{ticket: string}>(harness, '')
				.post('/reports/dsa/email/verify')
				.body({email, code})
				.expect(HTTP_STATUS.OK)
				.execute();

			const result = await createBuilder<ReportResponse>(harness, '')
				.post('/reports/dsa')
				.body({
					ticket: verifyResponse.ticket,
					report_type: 'guild',
					category: 'illegal_activity',
					guild_id: guild.id,
					reporter_full_legal_name: 'Jane Doe',
					reporter_country_of_residence: 'FR',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.report_id).toBeTruthy();
			expect(result.status).toBe('pending');
		});

		test('should reject DSA report with invalid ticket', async () => {
			const targetUser = await createTestAccount(harness);

			await createBuilderWithoutAuth(harness)
				.post('/reports/dsa')
				.body({
					ticket: 'invalid-ticket-value',
					report_type: 'user',
					category: 'harassment',
					user_id: targetUser.userId.toString(),
					reporter_full_legal_name: 'John Doe',
					reporter_country_of_residence: 'DE',
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should reject DSA report with malformed ticket', async () => {
			const targetUser = await createTestAccount(harness);

			await createBuilderWithoutAuth(harness)
				.post('/reports/dsa')
				.body({
					ticket: '',
					report_type: 'user',
					category: 'harassment',
					user_id: targetUser.userId,
					reporter_full_legal_name: 'John Doe',
					reporter_country_of_residence: 'DE',
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should require reporter_full_legal_name for DSA report', async () => {
			await clearTestEmails(harness);
			const email = createUniqueEmail('dsa-reporter');
			const targetUser = await createTestAccount(harness);

			await createBuilderWithoutAuth(harness).post('/reports/dsa/email/send').body({email}).execute();

			const emails = await listTestEmails(harness);
			const dsaEmail = findLastTestEmail(emails, 'dsa_report_verification');
			const code = dsaEmail!.metadata.code;

			const verifyResponse = await createBuilderWithoutAuth<{ticket: string}>(harness)
				.post('/reports/dsa/email/verify')
				.body({email, code})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilderWithoutAuth(harness)
				.post('/reports/dsa')
				.body({
					ticket: verifyResponse.ticket,
					report_type: 'user',
					category: 'harassment',
					user_id: targetUser.userId.toString(),
					reporter_country_of_residence: 'DE',
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should require EU country for DSA report', async () => {
			await clearTestEmails(harness);
			const email = createUniqueEmail('dsa-reporter');
			const targetUser = await createTestAccount(harness);

			await createBuilderWithoutAuth(harness).post('/reports/dsa/email/send').body({email}).execute();

			const emails = await listTestEmails(harness);
			const dsaEmail = findLastTestEmail(emails, 'dsa_report_verification');
			const code = dsaEmail!.metadata.code;

			const verifyResponse = await createBuilderWithoutAuth<{ticket: string}>(harness)
				.post('/reports/dsa/email/verify')
				.body({email, code})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilderWithoutAuth(harness)
				.post('/reports/dsa')
				.body({
					ticket: verifyResponse.ticket,
					report_type: 'user',
					category: 'harassment',
					user_id: targetUser.userId.toString(),
					reporter_full_legal_name: 'John Doe',
					reporter_country_of_residence: 'US',
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});
	});
});
