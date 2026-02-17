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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {loadFixture} from '@fluxer/api/src/channel/tests/AttachmentTestUtils';
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {
	createWebhook,
	deleteWebhook,
	executeWebhookWithAttachments,
} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Webhook multipart attachment uploads', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	it('executes webhook with attachment-only multipart payload', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook multipart upload guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'Multipart Upload Webhook');

		const {response, json} = await executeWebhookWithAttachments(harness, {
			webhookId: webhook.id,
			webhookToken: webhook.token,
			payload: {
				attachments: [{id: 0, filename: 'webhook_upload.png'}],
			},
			files: [{index: 0, filename: 'webhook_upload.png', data: loadFixture('yeah.png')}],
		});

		expect(response.status).toBe(HTTP_STATUS.OK);
		expect(json).not.toBeNull();
		expect(json?.webhook_id).toBe(webhook.id);
		expect(json?.attachments).toBeDefined();
		expect(json?.attachments?.length).toBe(1);
		expect(json?.attachments?.[0].filename).toBe('webhook_upload.png');

		await deleteWebhook(harness, webhook.id, owner.token);
	});

	it('executes webhook multipart payload with content and username overrides', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook multipart override guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'Multipart Override Webhook');

		const {response, json} = await executeWebhookWithAttachments(harness, {
			webhookId: webhook.id,
			webhookToken: webhook.token,
			payload: {
				content: 'Webhook with uploaded file',
				username: 'Upload Bot',
				attachments: [{id: 0, filename: 'upload.txt'}],
			},
			files: [{index: 0, filename: 'upload.txt', data: Buffer.from('uploaded through webhook')}],
		});

		expect(response.status).toBe(HTTP_STATUS.OK);
		expect(json).not.toBeNull();
		expect(json?.content).toBe('Webhook with uploaded file');
		expect(json?.attachments).toBeDefined();
		expect(json?.attachments?.length).toBe(1);
		expect(json?.attachments?.[0].filename).toBe('upload.txt');

		await deleteWebhook(harness, webhook.id, owner.token);
	});

	it('rejects multipart webhook requests with files but no attachment metadata', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook multipart metadata required guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'Metadata Required Webhook');

		const {response} = await executeWebhookWithAttachments(harness, {
			webhookId: webhook.id,
			webhookToken: webhook.token,
			payload: {
				content: 'missing metadata',
			},
			files: [{index: 0, filename: 'missing-metadata.png', data: loadFixture('yeah.png')}],
		});

		expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);

		await deleteWebhook(harness, webhook.id, owner.token);
	});

	it('rejects multipart webhook requests with attachment metadata but no file upload', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook multipart missing file guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'Missing File Webhook');

		const {response} = await executeWebhookWithAttachments(harness, {
			webhookId: webhook.id,
			webhookToken: webhook.token,
			payload: {
				attachments: [{id: 0, filename: 'missing.png'}],
			},
			files: [],
		});

		expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);

		await deleteWebhook(harness, webhook.id, owner.token);
	});

	it('rejects multipart webhook requests when file indices do not match metadata IDs', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook multipart id mismatch guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'ID Mismatch Webhook');

		const {response} = await executeWebhookWithAttachments(harness, {
			webhookId: webhook.id,
			webhookToken: webhook.token,
			payload: {
				attachments: [{id: 2, filename: 'mismatch.png'}],
			},
			files: [{index: 0, filename: 'mismatch.png', data: loadFixture('yeah.png')}],
		});

		expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);

		await deleteWebhook(harness, webhook.id, owner.token);
	});
});
