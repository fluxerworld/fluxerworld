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

import {createTestAccount, type TestAccount, totpCodeNow} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createGuild, setupTestGuildWithMembers} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {GuildMFALevel} from '@fluxer/constants/src/GuildConstants';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

async function enableTotp(harness: ApiTestHarness, account: TestAccount): Promise<void> {
	await createBuilder(harness, account.token)
		.post('/users/@me/mfa/totp/enable')
		.body({secret: TOTP_SECRET, code: totpCodeNow(TOTP_SECRET), password: account.password})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function loginWithTotp(harness: ApiTestHarness, account: TestAccount): Promise<TestAccount> {
	const loginResp = await createBuilderWithoutAuth<{mfa: true; ticket: string}>(harness)
		.post('/auth/login')
		.body({email: account.email, password: account.password})
		.expect(HTTP_STATUS.OK)
		.execute();

	const mfaResp = await createBuilderWithoutAuth<{token: string}>(harness)
		.post('/auth/login/mfa/totp')
		.body({code: totpCodeNow(TOTP_SECRET), ticket: loginResp.ticket})
		.expect(HTTP_STATUS.OK)
		.execute();

	return {...account, token: mfaResp.token};
}

describe('Guild MFA level', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('rejects enabling mfa_level when owner has no 2FA', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'MFA Test Guild');

		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}`)
			.body({mfa_level: GuildMFALevel.ELEVATED, password: owner.password})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects disabling mfa_level when owner has no 2FA', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'MFA Test Guild');

		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}`)
			.body({mfa_level: GuildMFALevel.NONE, password: owner.password})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('requires sudo mode when changing mfa_level', async () => {
		const owner = await createTestAccount(harness);
		await enableTotp(harness, owner);
		const loggedIn = await loginWithTotp(harness, owner);
		const guild = await createGuild(harness, loggedIn.token, 'MFA Test Guild');

		await createBuilder(harness, loggedIn.token)
			.patch(`/guilds/${guild.id}`)
			.body({mfa_level: GuildMFALevel.ELEVATED})
			.expect(HTTP_STATUS.FORBIDDEN, 'SUDO_MODE_REQUIRED')
			.execute();
	});

	it('allows enabling mfa_level with sudo verification via TOTP', async () => {
		const owner = await createTestAccount(harness);
		await enableTotp(harness, owner);
		const loggedIn = await loginWithTotp(harness, owner);
		const guild = await createGuild(harness, loggedIn.token, 'MFA Test Guild');

		const updated = await createBuilder<GuildResponse>(harness, loggedIn.token)
			.patch(`/guilds/${guild.id}`)
			.body({mfa_level: GuildMFALevel.ELEVATED, mfa_method: 'totp', mfa_code: totpCodeNow(TOTP_SECRET)})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(updated.mfa_level).toBe(GuildMFALevel.ELEVATED);
	});

	it('allows disabling mfa_level with sudo verification via TOTP', async () => {
		const owner = await createTestAccount(harness);
		await enableTotp(harness, owner);
		const loggedIn = await loginWithTotp(harness, owner);
		const guild = await createGuild(harness, loggedIn.token, 'MFA Test Guild');

		await createBuilder<GuildResponse>(harness, loggedIn.token)
			.patch(`/guilds/${guild.id}`)
			.body({mfa_level: GuildMFALevel.ELEVATED, mfa_method: 'totp', mfa_code: totpCodeNow(TOTP_SECRET)})
			.expect(HTTP_STATUS.OK)
			.execute();

		const updated = await createBuilder<GuildResponse>(harness, loggedIn.token)
			.patch(`/guilds/${guild.id}`)
			.body({mfa_level: GuildMFALevel.NONE, mfa_method: 'totp', mfa_code: totpCodeNow(TOTP_SECRET)})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(updated.mfa_level).toBe(GuildMFALevel.NONE);
	});

	it('rejects mfa_level change from non-owner', async () => {
		const {members, guild} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		await createBuilder(harness, member.token)
			.patch(`/guilds/${guild.id}`)
			.body({mfa_level: GuildMFALevel.ELEVATED, password: member.password})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('does not require sudo mode for non-mfa_level guild updates', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'MFA Test Guild');

		const updated = await createBuilder<GuildResponse>(harness, owner.token)
			.patch(`/guilds/${guild.id}`)
			.body({name: 'Renamed Guild'})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(updated.name).toBe('Renamed Guild');
	});
});
