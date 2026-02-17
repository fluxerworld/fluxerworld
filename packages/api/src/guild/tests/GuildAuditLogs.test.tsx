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
	createChannel,
	createChannelInvite,
	createRole,
	setupTestGuildWithMembers,
	updateRole,
} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {createWebhook} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface AuditLogChange {
	key: string;
	old_value?: unknown;
	new_value?: unknown;
}

interface AuditLogOptions {
	channel_id?: string;
	max_age?: number;
	max_uses?: number;
	temporary?: boolean;
}

interface AuditLogEntry {
	id: string;
	action_type: number;
	user_id: string | null;
	target_id: string | null;
	reason?: string;
	options?: AuditLogOptions;
	changes?: Array<AuditLogChange>;
}

interface AuditLogWebhook {
	id: string;
	type: number;
	guild_id: string | null;
	channel_id: string | null;
	name: string;
	avatar_hash: string | null;
}

interface AuditLogResponse {
	audit_log_entries: Array<AuditLogEntry>;
	users: Array<{id: string}>;
	webhooks: Array<AuditLogWebhook>;
}

interface PermissionsDiff {
	added: Array<string>;
	removed: Array<string>;
}

describe('Guild audit log endpoint', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('rejects unauthenticated requests', async () => {
		const {guild} = await setupTestGuildWithMembers(harness, 1);

		await createBuilderWithoutAuth(harness)
			.get(`/guilds/${guild.id}/audit-logs`)
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});

	test('requires view audit log permission', async () => {
		const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];

		await updateRole(harness, owner.token, guild.id, guild.id, {
			permissions: Permissions.VIEW_CHANNEL.toString(),
		});

		await createBuilder(harness, member.token)
			.get(`/guilds/${guild.id}/audit-logs`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('includes permissions diff entries for role updates', async () => {
		const {owner, guild} = await setupTestGuildWithMembers(harness, 1);

		const role = await createRole(harness, owner.token, guild.id, {
			name: 'Audit Role',
			permissions: Permissions.VIEW_CHANNEL.toString(),
		});

		await updateRole(harness, owner.token, guild.id, role.id, {
			permissions: (Permissions.VIEW_CHANNEL | Permissions.SEND_MESSAGES).toString(),
		});

		const response = await createBuilder<AuditLogResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?action_type=${AuditLogActionType.ROLE_UPDATE}`)
			.execute();

		const entry = response.audit_log_entries.find((log) => log.target_id === role.id);
		expect(entry).toBeDefined();

		const diffChange = entry?.changes?.find((change) => change.key === 'permissions_diff');
		expect(diffChange).toBeDefined();

		const permissionsDiff = diffChange?.new_value as PermissionsDiff | undefined;
		expect(permissionsDiff).toBeDefined();
		expect(permissionsDiff?.added).toContain('SEND_MESSAGES');
		expect(permissionsDiff?.removed).toEqual([]);
	});

	test('returns webhook references for webhook audit log entries', async () => {
		const {owner, guild} = await setupTestGuildWithMembers(harness, 1);
		const channel = await createChannel(harness, owner.token, guild.id, 'hooks');
		const webhook = await createWebhook(harness, channel.id, owner.token, 'Audit Webhook');

		const response = await createBuilder<AuditLogResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?action_type=${AuditLogActionType.WEBHOOK_CREATE}`)
			.execute();

		const entry = response.audit_log_entries.find((log) => log.target_id === webhook.id);
		expect(entry).toBeDefined();
		expect(entry?.options?.channel_id).toBe(channel.id);

		const webhookEntry = response.webhooks.find((record) => record.id === webhook.id);
		expect(webhookEntry).toBeDefined();
		expect(webhookEntry?.channel_id).toBe(channel.id);
		expect(webhookEntry?.guild_id).toBe(guild.id);
	});

	test('maps invite metadata into audit log options', async () => {
		const {owner, guild} = await setupTestGuildWithMembers(harness, 1);
		const channel = await createChannel(harness, owner.token, guild.id, 'invites');

		await createChannelInvite(harness, owner.token, channel.id);

		const response = await createBuilder<AuditLogResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?action_type=${AuditLogActionType.INVITE_CREATE}`)
			.execute();

		const entry = response.audit_log_entries.find((log) => log.options?.channel_id === channel.id);
		expect(entry).toBeDefined();
		expect(typeof entry?.options?.max_age).toBe('number');
		expect(typeof entry?.options?.max_uses).toBe('number');
		expect(typeof entry?.options?.temporary).toBe('boolean');
	});

	test('filters audit logs by user and action type', async () => {
		const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];

		await createRole(harness, owner.token, guild.id, {
			name: 'Owner Role',
			permissions: Permissions.VIEW_CHANNEL.toString(),
		});

		await createBuilder(harness, member.token)
			.patch(`/guilds/${guild.id}/members/@me`)
			.body({nick: 'Audit Nick'})
			.expect(HTTP_STATUS.OK)
			.execute();

		const responseByUser = await createBuilder<AuditLogResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?user_id=${member.userId}`)
			.execute();

		expect(responseByUser.audit_log_entries.length).toBeGreaterThan(0);
		for (const entry of responseByUser.audit_log_entries) {
			expect(entry.user_id).toBe(member.userId);
		}

		const responseByAction = await createBuilder<AuditLogResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?action_type=${AuditLogActionType.ROLE_CREATE}`)
			.execute();

		expect(responseByAction.audit_log_entries.length).toBeGreaterThan(0);
		for (const entry of responseByAction.audit_log_entries) {
			expect(entry.action_type).toBe(AuditLogActionType.ROLE_CREATE);
		}
	});

	test('includes target users for user-target audit log entries', async () => {
		const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];

		await createBuilder(harness, owner.token)
			.put(`/guilds/${guild.id}/bans/${member.userId}`)
			.body({reason: 'Audit log user list check'})
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		const response = await createBuilder<AuditLogResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?action_type=${AuditLogActionType.MEMBER_BAN_ADD}`)
			.execute();

		const userIds = response.users.map((user) => user.id);
		expect(userIds).toContain(owner.userId);
		expect(userIds).toContain(member.userId);
	});

	test('rejects specifying before and after together', async () => {
		const {owner, guild} = await setupTestGuildWithMembers(harness, 1);
		await createRole(harness, owner.token, guild.id, {
			name: 'Pagination Role',
			permissions: Permissions.VIEW_CHANNEL.toString(),
		});

		const response = await createBuilder<AuditLogResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?action_type=${AuditLogActionType.ROLE_CREATE}`)
			.execute();

		const logId = response.audit_log_entries[0]?.id;
		expect(logId).toBeDefined();

		await createBuilder(harness, owner.token)
			.get(`/guilds/${guild.id}/audit-logs?before=${logId}&after=${logId}`)
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.INVALID_FORM_BODY)
			.execute();
	});
});
