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

import {createAuthHarness, totpCodeNow} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	authenticateWithBotToken,
	createOAuth2BotApplication,
	createTestAccount,
	resetBotToken,
} from '@fluxer/api/src/bot/tests/BotTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Bot token reset with MFA sudo mode', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createAuthHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	it('requires sudo mode verification when user has MFA enabled', async () => {
		const owner = await createTestAccount(harness);
		const botApp = await createOAuth2BotApplication(harness, owner.token, `MFA Bot ${Date.now()}`, []);

		const secret = 'JBSWY3DPEHPK3PXP';
		const totpCode = totpCodeNow(secret);

		const totpData = await createBuilder<{backup_codes: Array<{code: string}>}>(harness, owner.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: totpCode, password: owner.password})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(totpData.backup_codes.length).toBeGreaterThan(0);

		const loginResp = await createBuilderWithoutAuth<{mfa: true; ticket: string}>(harness)
			.post('/auth/login')
			.body({email: owner.email, password: owner.password})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(loginResp.mfa).toBe(true);

		const mfaLoginResp = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/login/mfa/totp')
			.body({code: totpCodeNow(secret), ticket: loginResp.ticket})
			.expect(HTTP_STATUS.OK)
			.execute();
		const mfaToken = mfaLoginResp.token;

		await createBuilder(harness, mfaToken)
			.post(`/oauth2/applications/${botApp.appId}/bot/reset-token`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();

		const totpResetResp = await createBuilder<{token: string}>(harness, mfaToken)
			.post(`/oauth2/applications/${botApp.appId}/bot/reset-token`)
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
			})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(totpResetResp.token).toBeTruthy();
		expect(totpResetResp.token).not.toBe(botApp.botToken);

		const newBotAccount = await authenticateWithBotToken(harness, totpResetResp.token);
		expect(newBotAccount.userId).toBe(botApp.botUserId);
	});

	it('accepts password for sudo mode verification', async () => {
		const owner = await createTestAccount(harness);
		const botApp = await createOAuth2BotApplication(harness, owner.token, `Password Sudo Bot ${Date.now()}`, []);

		const newToken = await resetBotToken(harness, owner.token, botApp.appId, owner.password);
		expect(newToken).toBeTruthy();
		expect(newToken).not.toBe(botApp.botToken);

		const newBotAccount = await authenticateWithBotToken(harness, newToken);
		expect(newBotAccount.userId).toBe(botApp.botUserId);
	});

	it('rejects incorrect password for sudo mode verification', async () => {
		const owner = await createTestAccount(harness);
		const botApp = await createOAuth2BotApplication(harness, owner.token, `Bad Password Bot ${Date.now()}`, []);

		await createBuilder(harness, owner.token)
			.post(`/oauth2/applications/${botApp.appId}/bot/reset-token`)
			.body({password: 'wrong-password-12345'})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		const originalBotAccount = await authenticateWithBotToken(harness, botApp.botToken);
		expect(originalBotAccount.userId).toBe(botApp.botUserId);
	});

	it('accepts TOTP code for sudo mode verification', async () => {
		const owner = await createTestAccount(harness);
		const botApp = await createOAuth2BotApplication(harness, owner.token, `TOTP Sudo Bot ${Date.now()}`, []);

		const secret = 'JBSWY3DPEHPK3PXP';
		const totpCode = totpCodeNow(secret);

		await createBuilder(harness, owner.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: totpCode, password: owner.password})
			.expect(HTTP_STATUS.OK)
			.execute();

		const loginResp = await createBuilderWithoutAuth<{mfa: true; ticket: string}>(harness)
			.post('/auth/login')
			.body({email: owner.email, password: owner.password})
			.expect(HTTP_STATUS.OK)
			.execute();

		const mfaLoginResp = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/login/mfa/totp')
			.body({code: totpCodeNow(secret), ticket: loginResp.ticket})
			.expect(HTTP_STATUS.OK)
			.execute();
		const mfaToken = mfaLoginResp.token;

		const totpResetResp = await createBuilder<{token: string}>(harness, mfaToken)
			.post(`/oauth2/applications/${botApp.appId}/bot/reset-token`)
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
			})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(totpResetResp.token).toBeTruthy();
		expect(totpResetResp.token).not.toBe(botApp.botToken);

		const newBotAccount = await authenticateWithBotToken(harness, totpResetResp.token);
		expect(newBotAccount.userId).toBe(botApp.botUserId);
	});

	it('rejects incorrect TOTP code for sudo mode verification', async () => {
		const owner = await createTestAccount(harness);
		const botApp = await createOAuth2BotApplication(harness, owner.token, `Bad TOTP Bot ${Date.now()}`, []);

		const secret = 'JBSWY3DPEHPK3PXP';
		const totpCode = totpCodeNow(secret);

		await createBuilder(harness, owner.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: totpCode, password: owner.password})
			.expect(HTTP_STATUS.OK)
			.execute();

		const loginResp = await createBuilderWithoutAuth<{mfa: true; ticket: string}>(harness)
			.post('/auth/login')
			.body({email: owner.email, password: owner.password})
			.expect(HTTP_STATUS.OK)
			.execute();

		const mfaLoginResp = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/login/mfa/totp')
			.body({code: totpCodeNow(secret), ticket: loginResp.ticket})
			.expect(HTTP_STATUS.OK)
			.execute();
		const mfaToken = mfaLoginResp.token;

		await createBuilder(harness, mfaToken)
			.post(`/oauth2/applications/${botApp.appId}/bot/reset-token`)
			.body({
				mfa_method: 'totp',
				mfa_code: '000000',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		const originalBotAccount = await authenticateWithBotToken(harness, botApp.botToken);
		expect(originalBotAccount.userId).toBe(botApp.botUserId);
	});

	it('allows sudo mode after password verification for non-MFA users', async () => {
		const owner = await createTestAccount(harness);
		const botApp = await createOAuth2BotApplication(harness, owner.token, `Non-MFA Sudo Bot ${Date.now()}`, []);

		const newToken = await resetBotToken(harness, owner.token, botApp.appId, owner.password);
		expect(newToken).toBeTruthy();
		expect(newToken).not.toBe(botApp.botToken);

		const newBotAccount = await authenticateWithBotToken(harness, newToken);
		expect(newBotAccount.userId).toBe(botApp.botUserId);
	});
});
