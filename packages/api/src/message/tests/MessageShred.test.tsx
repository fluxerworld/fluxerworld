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

import {createTestAccount, setUserACLs} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {acceptInvite, createChannelInvite, createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {ensureSessionStarted, sendMessage} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface MessageShredQueueResponse {
	success: boolean;
	job_id: string;
	requested: number;
}

interface MessageShredStatusResponse {
	status: 'in_progress' | 'completed' | 'failed' | 'not_found';
	requested?: number;
	total?: number;
	processed?: number;
	skipped?: number;
	started_at?: string;
	completed_at?: string;
	failed_at?: string;
	error?: string;
}

describe('Message Shred', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('Permission Requirements', () => {
		test('should require authentication to shred messages', async () => {
			await createBuilderWithoutAuth(harness)
				.post('/admin/messages/shred')
				.body({
					user_id: '123456789',
					entries: [{channel_id: '123', message_id: '456'}],
				})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});

		test('should require admin:authenticate ACL to access admin endpoints', async () => {
			const user = await createTestAccount(harness);

			await createBuilder(harness, `Bearer ${user.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: user.userId,
					entries: [{channel_id: '123', message_id: '456'}],
				})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('should require message:shred ACL to shred messages', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate']);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: '123456789',
					entries: [{channel_id: '123', message_id: '456'}],
				})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('should allow shred with message:shred ACL', async () => {
			const target = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			const guild = await createGuild(harness, target.token, 'Shred Test Guild');
			const channelId = guild.system_channel_id!;

			await ensureSessionStarted(harness, target.token);
			const message = await sendMessage(harness, target.token, channelId, 'Message to shred');

			const queueResponse = await createBuilder<MessageShredQueueResponse>(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: target.userId,
					entries: [{channel_id: channelId, message_id: message.id}],
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(queueResponse.success).toBe(true);
			expect(queueResponse.job_id).toBeDefined();
			expect(queueResponse.requested).toBe(1);
		});
	});

	describe('Shred Job Queueing', () => {
		test('should queue shred job with valid entries', async () => {
			const target = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			const guild = await createGuild(harness, target.token, 'Shred Test Guild');
			const channelId = guild.system_channel_id!;

			await ensureSessionStarted(harness, target.token);
			const message1 = await sendMessage(harness, target.token, channelId, 'First message');
			const message2 = await sendMessage(harness, target.token, channelId, 'Second message');

			const queueResponse = await createBuilder<MessageShredQueueResponse>(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: target.userId,
					entries: [
						{channel_id: channelId, message_id: message1.id},
						{channel_id: channelId, message_id: message2.id},
					],
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(queueResponse.success).toBe(true);
			expect(queueResponse.job_id).toBeDefined();
			expect(queueResponse.requested).toBe(2);
		});

		test('should reject shred request with empty entries array', async () => {
			const target = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			await createBuilder(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: target.userId,
					entries: [],
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should accept large batch of entries', async () => {
			const target = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			const guild = await createGuild(harness, target.token, 'Large Shred Guild');
			const channelId = guild.system_channel_id!;

			await ensureSessionStarted(harness, target.token);
			const messages = [];
			for (let i = 0; i < 10; i++) {
				const message = await sendMessage(harness, target.token, channelId, `Message ${i}`);
				messages.push(message);
			}

			const entries = [];
			for (let i = 0; i < 100; i++) {
				const message = messages[i % messages.length]!;
				entries.push({channel_id: channelId, message_id: message.id});
			}

			const queueResponse = await createBuilder<MessageShredQueueResponse>(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: target.userId,
					entries,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(queueResponse.success).toBe(true);
			expect(queueResponse.requested).toBe(100);
		});

		test('should require valid user_id in request', async () => {
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			await createBuilder(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.body({
					entries: [{channel_id: '123', message_id: '456'}],
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should require valid channel_id in entries', async () => {
			const target = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			await createBuilder(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: target.userId,
					entries: [{message_id: '456'}],
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('should require valid message_id in entries', async () => {
			const target = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			await createBuilder(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: target.userId,
					entries: [{channel_id: '123'}],
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});
	});

	describe('Shred Status', () => {
		test('should require message:shred ACL for status check', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate']);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.post('/admin/messages/shred-status')
				.body({
					job_id: '123456789',
				})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('should return not_found for non-existent job', async () => {
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			const statusResponse = await createBuilder<MessageShredStatusResponse>(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred-status')
				.body({
					job_id: '999999999999999999',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(statusResponse.status).toBe('not_found');
		});

		test('should require job_id in status request', async () => {
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			await createBuilder(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred-status')
				.body({})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});
	});

	describe('Shred with Multiple Users', () => {
		test('should only accept messages from target user', async () => {
			const target = await createTestAccount(harness);
			const otherUser = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			const guild = await createGuild(harness, target.token, 'Multi User Shred Guild');
			const channelId = guild.system_channel_id!;

			const invite = await createChannelInvite(harness, target.token, channelId);
			await acceptInvite(harness, otherUser.token, invite.code);

			await ensureSessionStarted(harness, target.token);
			await ensureSessionStarted(harness, otherUser.token);
			const targetMessage = await sendMessage(harness, target.token, channelId, 'Target message');
			const otherMessage = await sendMessage(harness, otherUser.token, channelId, 'Other user message');

			const queueResponse = await createBuilder<MessageShredQueueResponse>(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.body({
					user_id: target.userId,
					entries: [
						{channel_id: channelId, message_id: targetMessage.id},
						{channel_id: channelId, message_id: otherMessage.id},
					],
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(queueResponse.success).toBe(true);
			expect(queueResponse.requested).toBe(2);
		});
	});

	describe('Audit Trail', () => {
		test('should include audit reason header if provided', async () => {
			const target = await createTestAccount(harness);
			const admin = await createTestAccount(harness);
			const updatedAdmin = await setUserACLs(harness, admin, ['admin:authenticate', 'message:shred']);

			const guild = await createGuild(harness, target.token, 'Audit Shred Guild');
			const channelId = guild.system_channel_id!;

			await ensureSessionStarted(harness, target.token);
			const message = await sendMessage(harness, target.token, channelId, 'Message to shred with audit');

			const queueResponse = await createBuilder<MessageShredQueueResponse>(harness, `Bearer ${updatedAdmin.token}`)
				.post('/admin/messages/shred')
				.header('X-Audit-Log-Reason', 'GDPR deletion request')
				.body({
					user_id: target.userId,
					entries: [{channel_id: channelId, message_id: message.id}],
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(queueResponse.success).toBe(true);
		});
	});
});
