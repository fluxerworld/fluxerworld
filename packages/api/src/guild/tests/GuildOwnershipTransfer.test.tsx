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
import {acceptInvite, createChannelInvite, createGuild, getChannel} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS, TEST_CREDENTIALS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Guild Ownership Transfer', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('rejects transfer to a bot user', async () => {
		const owner = await createTestAccount(harness);
		const botAccount = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Transfer Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, botAccount.token, invite.code);

		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${botAccount.userId}/set-bot-flag`)
			.body({is_bot: true})
			.execute();

		await createBuilder(harness, owner.token)
			.post(`/guilds/${guild.id}/transfer-ownership`)
			.body({new_owner_id: botAccount.userId, password: TEST_CREDENTIALS.STRONG_PASSWORD})
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CANNOT_TRANSFER_OWNERSHIP_TO_BOT)
			.execute();
	});

	it('allows transfer to a non-bot user', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Transfer Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		const updatedGuild = await createBuilder<GuildResponse>(harness, owner.token)
			.post(`/guilds/${guild.id}/transfer-ownership`)
			.body({new_owner_id: member.userId, password: TEST_CREDENTIALS.STRONG_PASSWORD})
			.execute();

		expect(updatedGuild.owner_id).toBe(member.userId);
	});
});
