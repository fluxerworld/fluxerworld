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

import {createChannelInvite} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {banUser, createBannedUserSetup} from '@fluxer/api/src/moderation/tests/ModerationTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, it} from 'vitest';

describe('Banned user restrictions', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	it('prevents banned users from accessing guild', async () => {
		const {owner, target, guild} = await createBannedUserSetup(harness);

		await banUser(harness, owner.token, guild.id, target.userId, 0);

		await createBuilder(harness, target.token).get(`/guilds/${guild.id}`).expect(HTTP_STATUS.FORBIDDEN).execute();
	});

	it('prevents banned users from sending messages', async () => {
		const {owner, target, guild, channelId} = await createBannedUserSetup(harness);

		await banUser(harness, owner.token, guild.id, target.userId, 0);

		await createBuilder(harness, target.token)
			.post(`/channels/${channelId}/messages`)
			.body({content: "I'm banned"})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('prevents banned users from rejoining via invite', async () => {
		const {owner, target, guild} = await createBannedUserSetup(harness);

		await banUser(harness, owner.token, guild.id, target.userId, 0);

		const invite = await createChannelInvite(harness, owner.token, guild.system_channel_id!);

		await createBuilder(harness, target.token)
			.post(`/invites/${invite.code}`)
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
});
