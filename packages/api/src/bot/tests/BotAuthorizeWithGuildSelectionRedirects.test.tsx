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

import {createAuthHarness} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {authorizeBot, createOAuth2BotApplication, createTestAccount} from '@fluxer/api/src/bot/tests/BotTestUtils';
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Bot authorize with guild selection redirects', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createAuthHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	it('redirects to guild selection when bot is authorized with guild_id', async () => {
		const owner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const botApp = await createOAuth2BotApplication(harness, owner.token, `Bot Guild Select ${Date.now()}`, []);

		const guild = await createGuild(harness, endUser.token, 'Test Guild for Bot Auth');

		const {redirectUrl} = await authorizeBot(harness, endUser.token, botApp.appId, ['bot'], guild.id, '8');

		expect(redirectUrl).toBeTruthy();
		expect(typeof redirectUrl).toBe('string');
	});
});
