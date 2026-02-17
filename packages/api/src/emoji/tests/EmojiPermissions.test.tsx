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
import {
	assignRoleToMember,
	createEmoji,
	createGuildWithMember,
	createTestRole,
	deleteEmoji,
	getPngDataUrl,
	listEmojis,
	PERMISSIONS,
	updateEmoji,
} from '@fluxer/api/src/emoji/tests/EmojiTestUtils';
import {updateRole} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Emoji permissions', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('allows members with CREATE_EXPRESSIONS to create emoji', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});

		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const emoji = await createEmoji(harness, member.token, guild.id, {
			name: 'membermoji',
			image: getPngDataUrl(),
		});

		expect(emoji.name).toBe('membermoji');
	});

	it('prevents members without CREATE_EXPRESSIONS from creating emoji', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		await updateRole(harness, owner.token, guild.id, guild.id, {
			permissions: PERMISSIONS.DEFAULT_WITHOUT_CREATE.toString(),
		});

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'NoExpressions',
			permissions: PERMISSIONS.DEFAULT_WITHOUT_CREATE.toString(),
		});

		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		await createBuilder(harness, member.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: 'noperms',
				image: getPngDataUrl(),
			})
			.expect(403)
			.execute();
	});

	it('allows creator to update their own emoji with CREATE_EXPRESSIONS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const emoji = await createEmoji(harness, member.token, guild.id, {
			name: 'myemoji',
			image: getPngDataUrl(),
		});

		const updated = await updateEmoji(harness, member.token, guild.id, emoji.id, {
			name: 'myupdatedemoji',
		});

		expect(updated.name).toBe('myupdatedemoji');
	});

	it('prevents creator from updating another users emoji with only CREATE_EXPRESSIONS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const ownerEmoji = await createEmoji(harness, owner.token, guild.id, {
			name: 'owneremoji',
			image: getPngDataUrl(),
		});

		await createBuilder(harness, member.token)
			.patch(`/guilds/${guild.id}/emojis/${ownerEmoji.id}`)
			.body({name: 'hackedemoji'})
			.expect(403)
			.execute();
	});

	it('allows members with MANAGE_EXPRESSIONS to update any emoji', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Manager',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.MANAGE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const ownerEmoji = await createEmoji(harness, owner.token, guild.id, {
			name: 'owneremoji',
			image: getPngDataUrl(),
		});

		const updated = await updateEmoji(harness, member.token, guild.id, ownerEmoji.id, {
			name: 'managedemoji',
		});

		expect(updated.name).toBe('managedemoji');
	});

	it('prevents creator from deleting another users emoji with only CREATE_EXPRESSIONS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const ownerEmoji = await createEmoji(harness, owner.token, guild.id, {
			name: 'owneremoji',
			image: getPngDataUrl(),
		});

		await createBuilder(harness, member.token)
			.delete(`/guilds/${guild.id}/emojis/${ownerEmoji.id}`)
			.expect(403)
			.execute();
	});

	it('allows members with MANAGE_EXPRESSIONS to delete any emoji', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Manager',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.MANAGE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const ownerEmoji = await createEmoji(harness, owner.token, guild.id, {
			name: 'owneremoji',
			image: getPngDataUrl(),
		});

		await deleteEmoji(harness, member.token, guild.id, ownerEmoji.id);
	});

	it('allows creator to delete their own emoji with CREATE_EXPRESSIONS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const emoji = await createEmoji(harness, member.token, guild.id, {
			name: 'myemoji',
			image: getPngDataUrl(),
		});

		await deleteEmoji(harness, member.token, guild.id, emoji.id);
	});

	it('allows listing emojis for guild members', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		await createEmoji(harness, owner.token, guild.id, {
			name: 'ownermoji',
			image: getPngDataUrl(),
		});

		const emojis = await listEmojis(harness, member.token, guild.id);
		expect(emojis.length).toBe(1);
		expect(emojis[0].name).toBe('ownermoji');
	});
});
