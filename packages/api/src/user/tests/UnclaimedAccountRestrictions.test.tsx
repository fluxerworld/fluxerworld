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

import {createTestAccount, createUniqueUsername, unclaimAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	acceptInvite,
	createChannelInvite,
	createGuild,
	getChannel,
	sendChannelMessage,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {fetchUserNote, grantPremium, setUserNote} from '@fluxer/api/src/user/tests/UserTestUtils';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {beforeEach, describe, expect, test} from 'vitest';

describe('Unclaimed Account Restrictions', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	describe('Messaging Restrictions', () => {
		test('unclaimed account cannot send guild messages', async () => {
			const owner = await createTestAccount(harness);
			const member = await createTestAccount(harness);

			const guild = await createGuild(harness, owner.token, 'Test Guild');
			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const invite = await createChannelInvite(harness, owner.token, channel.id);
			await acceptInvite(harness, member.token, invite.code);

			await unclaimAccount(harness, member.userId);

			await createBuilder(harness, member.token)
				.post(`/channels/${channel.id}/messages`)
				.body({content: 'Hello world'})
				.expect(HTTP_STATUS.BAD_REQUEST, 'UNCLAIMED_ACCOUNT_CANNOT_SEND_MESSAGES')
				.execute();
		});

		test('unclaimed account can receive DMs', async () => {
			const receiver = await createTestAccount(harness);

			await unclaimAccount(harness, receiver.userId);

			await createBuilder(harness, receiver.token).get('/users/@me').expect(HTTP_STATUS.OK).execute();
		});

		test('unclaimed account cannot add reactions', async () => {
			const owner = await createTestAccount(harness);
			const user = await createTestAccount(harness);

			const guild = await createGuild(harness, owner.token, 'Test Guild');
			const channel = await getChannel(harness, owner.token, guild.system_channel_id!);
			const invite = await createChannelInvite(harness, owner.token, channel.id);
			await acceptInvite(harness, user.token, invite.code);

			const message = await sendChannelMessage(harness, owner.token, channel.id, 'React to this');

			await unclaimAccount(harness, user.userId);

			await createBuilder(harness, user.token)
				.put(`/channels/${channel.id}/messages/${message.id}/reactions/${encodeURIComponent('👍')}/@me`)
				.expect(HTTP_STATUS.BAD_REQUEST, 'UNCLAIMED_ACCOUNT_CANNOT_ADD_REACTIONS')
				.execute();
		});
	});

	describe('Friend Request Restrictions', () => {
		test('unclaimed account cannot send friend request', async () => {
			const unclaimedAccount = await createTestAccount(harness);
			const targetAccount = await createTestAccount(harness);

			await unclaimAccount(harness, unclaimedAccount.userId);

			await createBuilder(harness, unclaimedAccount.token)
				.post(`/users/@me/relationships/${targetAccount.userId}`)
				.expect(HTTP_STATUS.BAD_REQUEST, 'UNCLAIMED_ACCOUNT_CANNOT_SEND_FRIEND_REQUESTS')
				.execute();
		});

		test('unclaimed account cannot accept friend request', async () => {
			const senderAccount = await createTestAccount(harness);
			const receiverAccount = await createTestAccount(harness);

			await createBuilder(harness, senderAccount.token)
				.post(`/users/@me/relationships/${receiverAccount.userId}`)
				.execute();

			await unclaimAccount(harness, receiverAccount.userId);

			await createBuilder(harness, receiverAccount.token)
				.put(`/users/@me/relationships/${senderAccount.userId}`)
				.body({type: 1})
				.expect(HTTP_STATUS.BAD_REQUEST, 'UNCLAIMED_ACCOUNT_CANNOT_ACCEPT_FRIEND_REQUESTS')
				.execute();
		});
	});

	describe('Allowed Operations', () => {
		test('unclaimed account can use personal notes', async () => {
			const user = await createTestAccount(harness);
			const target = await createTestAccount(harness);

			await unclaimAccount(harness, user.userId);

			const noteContent = 'Note from unclaimed account';
			await setUserNote(harness, user.token, target.userId, noteContent);

			const {json} = await fetchUserNote(harness, user.token, target.userId);
			const note = json as {note: string | null};
			expect(note.note).toBe(noteContent);
		});

		test('unclaimed account can change username', async () => {
			const account = await createTestAccount(harness);
			const newUsername = createUniqueUsername('unclaimed_update');

			await unclaimAccount(harness, account.userId);

			const updated = await createBuilder<{username: string; discriminator: string}>(harness, account.token)
				.patch('/users/@me')
				.body({username: newUsername})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updated.username).toBe(newUsername);
		});

		test('unclaimed premium account can change discriminator', async () => {
			const account = await createTestAccount(harness);
			await grantPremium(harness, account.userId, UserPremiumTypes.SUBSCRIPTION);

			await unclaimAccount(harness, account.userId);

			const updated = await createBuilder<{username: string; discriminator: string}>(harness, account.token)
				.patch('/users/@me')
				.body({discriminator: '0067'})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updated.discriminator).toBe('0067');
		});

		test('unclaimed premium account can change username and discriminator together', async () => {
			const account = await createTestAccount(harness);
			const newUsername = createUniqueUsername('unclaimed_combo');
			await grantPremium(harness, account.userId, UserPremiumTypes.SUBSCRIPTION);

			await unclaimAccount(harness, account.userId);

			const updated = await createBuilder<{username: string; discriminator: string}>(harness, account.token)
				.patch('/users/@me')
				.body({username: newUsername, discriminator: '0068'})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updated.username).toBe(newUsername);
			expect(updated.discriminator).toBe('0068');
		});
	});

	describe('Profile Update Restrictions', () => {
		test('unclaimed account rejects unsupported profile fields', async () => {
			const account = await createTestAccount(harness);
			await unclaimAccount(harness, account.userId);

			const {response, text} = await createBuilder(harness, account.token)
				.patch('/users/@me')
				.body({bio: 'not allowed'})
				.executeRaw();

			expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
			expect(text).toContain('UNCLAIMED_ACCOUNTS_CAN_ONLY_SET_EMAIL_VIA_TOKEN');
		});
	});

	describe('Account Deletion', () => {
		test('unclaimed account can be deleted without password', async () => {
			const account = await createTestAccount(harness);

			await unclaimAccount(harness, account.userId);

			await createBuilder(harness, account.token)
				.post('/users/@me/delete')
				.body({})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await createBuilder(harness, account.token).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
		});
	});
});
