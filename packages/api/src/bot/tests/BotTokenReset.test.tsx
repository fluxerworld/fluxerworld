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

describe('Bot token reset', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createAuthHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	it('resets bot tokens through OAuth2 application API', async () => {
		const owner = await createTestAccount(harness);

		const appName = `Test Bot Reset ${Date.now()}`;
		const redirectURI = 'https://example.com/callback';
		const botApp = await createOAuth2BotApplication(harness, owner.token, appName, [redirectURI]);

		expect(botApp.botToken).toBeTruthy();
		expect(botApp.botToken.length).toBeGreaterThan(20);

		const botAccount = await authenticateWithBotToken(harness, botApp.botToken);
		expect(botAccount.userId).toBe(botApp.botUserId);

		const newToken = await resetBotToken(harness, owner.token, botApp.appId, owner.password);
		expect(newToken).toBeTruthy();
		expect(newToken).not.toBe(botApp.botToken);

		const newBotAccount = await authenticateWithBotToken(harness, newToken);
		expect(newBotAccount.userId).toBe(botApp.botUserId);

		await createBuilder(harness, `Bot ${botApp.botToken}`).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();

		const anotherToken = await resetBotToken(harness, owner.token, botApp.appId, owner.password);
		expect(anotherToken).toBeTruthy();
		expect(anotherToken).not.toBe(newToken);
		expect(anotherToken).not.toBe(botApp.botToken);

		const finalBotAccount = await authenticateWithBotToken(harness, anotherToken);
		expect(finalBotAccount.userId).toBe(botApp.botUserId);

		await createBuilder(harness, `Bot ${newToken}`).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
	});

	it('requires sudo mode for MFA-enabled accounts', async () => {
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

		const secondResetResp = await createBuilder<{token: string}>(harness, mfaToken)
			.post(`/oauth2/applications/${botApp.appId}/bot/reset-token`)
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
			})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(secondResetResp.token).toBeTruthy();
		expect(secondResetResp.token).not.toBe(totpResetResp.token);

		const finalBotAccount = await authenticateWithBotToken(harness, secondResetResp.token);
		expect(finalBotAccount.userId).toBe(botApp.botUserId);
	});
});
