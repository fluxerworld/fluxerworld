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
	createGuildWithMember,
	createSticker,
	createTestRole,
	deleteSticker,
	getPngDataUrl,
	PERMISSIONS,
	updateSticker,
} from '@fluxer/api/src/emoji/tests/EmojiTestUtils';
import {updateRole} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Sticker permissions', () => {
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

	it('allows members with CREATE_EXPRESSIONS to create sticker', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});

		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const sticker = await createSticker(harness, member.token, guild.id, {
			name: 'creatorsticker',
			description: 'A test sticker',
			tags: ['test'],
			image: getPngDataUrl(),
		});

		expect(sticker.name).toBe('creatorsticker');
	});

	it('prevents members without CREATE_EXPRESSIONS from creating sticker', async () => {
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
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'nopermssticker',
				description: 'A test sticker',
				tags: ['test'],
				image: getPngDataUrl(),
			})
			.expect(403)
			.execute();
	});

	it('allows creator to update their own sticker with CREATE_EXPRESSIONS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const sticker = await createSticker(harness, member.token, guild.id, {
			name: 'mysticker',
			description: 'My sticker',
			tags: ['mine'],
			image: getPngDataUrl(),
		});

		const updated = await updateSticker(harness, member.token, guild.id, sticker.id, {
			name: 'myupdatedsticker',
			description: 'Updated description',
			tags: ['updated'],
		});

		expect(updated.name).toBe('myupdatedsticker');
	});

	it('prevents creator from updating another users sticker with only CREATE_EXPRESSIONS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const ownerSticker = await createSticker(harness, owner.token, guild.id, {
			name: 'ownersticker',
			description: 'Owner sticker',
			tags: ['owner'],
			image: getPngDataUrl(),
		});

		await createBuilder(harness, member.token)
			.patch(`/guilds/${guild.id}/stickers/${ownerSticker.id}`)
			.body({
				name: 'hackedsticker',
				description: 'Hacked description',
				tags: ['hacked'],
			})
			.expect(403)
			.execute();
	});

	it('allows members with MANAGE_EXPRESSIONS to update any sticker', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Manager',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.MANAGE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const ownerSticker = await createSticker(harness, owner.token, guild.id, {
			name: 'ownersticker',
			description: 'Owner sticker',
			tags: ['owner'],
			image: getPngDataUrl(),
		});

		const updated = await updateSticker(harness, member.token, guild.id, ownerSticker.id, {
			name: 'managedsticker',
			description: 'Managed update',
			tags: ['managed'],
		});

		expect(updated.name).toBe('managedsticker');
	});

	it('prevents creator from deleting another users sticker with only CREATE_EXPRESSIONS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const ownerSticker = await createSticker(harness, owner.token, guild.id, {
			name: 'ownersticker',
			description: 'Owner sticker',
			tags: ['owner'],
			image: getPngDataUrl(),
		});

		await createBuilder(harness, member.token)
			.delete(`/guilds/${guild.id}/stickers/${ownerSticker.id}`)
			.expect(403)
			.execute();
	});

	it('allows members with MANAGE_EXPRESSIONS to delete any sticker', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Manager',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.MANAGE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const ownerSticker = await createSticker(harness, owner.token, guild.id, {
			name: 'ownersticker',
			description: 'Owner sticker',
			tags: ['owner'],
			image: getPngDataUrl(),
		});

		await deleteSticker(harness, member.token, guild.id, ownerSticker.id);
	});

	it('allows creator to delete their own sticker with CREATE_EXPRESSIONS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {guild} = await createGuildWithMember(harness, owner, member);

		const role = await createTestRole(harness, owner.token, guild.id, {
			name: 'Creator',
			permissions: (PERMISSIONS.DEFAULT_WITHOUT_CREATE | PERMISSIONS.CREATE_EXPRESSIONS).toString(),
		});
		await assignRoleToMember(harness, owner.token, guild.id, member.userId, role.id);

		const sticker = await createSticker(harness, member.token, guild.id, {
			name: 'mysticker',
			description: 'My sticker',
			tags: ['mine'],
			image: getPngDataUrl(),
		});

		await deleteSticker(harness, member.token, guild.id, sticker.id);
	});
});
