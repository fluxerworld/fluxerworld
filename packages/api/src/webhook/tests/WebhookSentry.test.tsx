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
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {createWebhook, deleteWebhook} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import {afterEach, beforeEach, describe, it} from 'vitest';

function createSentryIssue() {
	return {
		id: '12345',
		shortId: 'TEST-123',
		title: 'TypeError: Cannot read property of undefined',
		culprit: 'src/components/App.tsx',
		permalink: 'https://sentry.io/organizations/test/issues/12345/',
		level: 'error',
		status: 'unresolved',
		platform: 'javascript',
		project: {
			id: '1',
			name: 'test-project',
			slug: 'test-project',
			platform: 'javascript',
		},
		type: 'error',
		metadata: {
			value: 'Cannot read property x of undefined',
			type: 'TypeError',
		},
		count: '42',
		userCount: 5,
		firstSeen: '2024-01-01T00:00:00.000Z',
		lastSeen: '2024-01-15T12:00:00.000Z',
	};
}

describe('Webhook Sentry integration', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('POST /webhooks/:webhook_id/:token/sentry', () => {
		it('accepts valid sentry issue event', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Sentry Webhook Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Sentry Webhook');

			const sentryPayload = {
				action: 'created',
				data: {
					issue: createSentryIssue(),
				},
				installation: {
					uuid: 'installation-uuid-123',
				},
				actor: {
					type: 'user',
					id: '1',
					name: 'Test User',
				},
			};

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}/sentry`)
				.header('X-Sentry-Event', 'issue.created')
				.body(sentryPayload)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('accepts sentry issue resolved event', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Sentry Resolved Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Sentry Resolved Webhook');

			const sentryPayload = {
				action: 'resolved',
				data: {
					issue: {
						...createSentryIssue(),
						status: 'resolved',
					},
				},
				installation: {
					uuid: 'installation-uuid-456',
				},
			};

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}/sentry`)
				.header('X-Sentry-Event', 'issue.resolved')
				.body(sentryPayload)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects sentry webhook with invalid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Sentry Invalid Token Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Sentry Invalid Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/invalid_token/sentry`)
				.header('X-Sentry-Event', 'issue.created')
				.body({
					action: 'created',
					data: {
						issue: createSentryIssue(),
					},
				})
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('handles sentry webhook with missing event header', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Sentry No Header Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Sentry No Header Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}/sentry`)
				.body({
					action: 'created',
					data: {
						issue: createSentryIssue(),
					},
				})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('handles unknown sentry event type gracefully', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Sentry Unknown Event Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Sentry Unknown Event Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}/sentry`)
				.header('X-Sentry-Event', 'unknown.event.type')
				.body({
					action: 'unknown',
					data: {
						issue: createSentryIssue(),
					},
				})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('accepts minimal sentry payload', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Sentry Minimal Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Sentry Minimal Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}/sentry`)
				.body({})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});
});
