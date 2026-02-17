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

import {createTestAccount, createTotpSecret, totpCodeNow} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createGuild, getMember, getRoles} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {
	createOAuth2Application,
	createUniqueApplicationName,
	getOAuth2Application,
} from '@fluxer/api/src/oauth/tests/OAuth2TestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {grantPremium} from '@fluxer/api/src/user/tests/UserTestUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import type {ApplicationBotResponse} from '@fluxer/schema/src/domains/oauth/OAuthSchemas';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('OAuth2 Bot Operations', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('Bot profile updates', () => {
		test('bot profile can be updated by application owner', async () => {
			const owner = await createTestAccount(harness);
			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const newUsername = `UpdatedBot${Date.now() % 10000}`;
			const updatedBot = await createBuilder<ApplicationBotResponse>(harness, owner.token)
				.patch(`/oauth2/applications/${app.application.id}/bot`)
				.body({
					username: newUsername,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updatedBot.username).toBe(newUsername);
		});

		test('bot bio can be updated by application owner', async () => {
			const owner = await createTestAccount(harness);
			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const newBio = 'This is a test bot for integration testing';
			const updatedBot = await createBuilder<ApplicationBotResponse>(harness, owner.token)
				.patch(`/oauth2/applications/${app.application.id}/bot`)
				.body({
					bio: newBio,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updatedBot.bio).toBe(newBio);
		});

		test('multiple bot profile fields can be updated together', async () => {
			const owner = await createTestAccount(harness);
			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const newUsername = `MultiBot${Date.now() % 10000}`;
			const newBio = 'Updated bio and username together';
			const updatedBot = await createBuilder<ApplicationBotResponse>(harness, owner.token)
				.patch(`/oauth2/applications/${app.application.id}/bot`)
				.body({
					username: newUsername,
					bio: newBio,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updatedBot.username).toBe(newUsername);
			expect(updatedBot.bio).toBe(newBio);
		});

		test('bot profile update returns discriminator', async () => {
			const owner = await createTestAccount(harness);
			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const updatedBot = await createBuilder<ApplicationBotResponse>(harness, owner.token)
				.patch(`/oauth2/applications/${app.application.id}/bot`)
				.body({
					bio: 'Testing discriminator return',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updatedBot.discriminator).toBeTruthy();
		});

		test('bot discriminator cannot be changed (even for visionary owners)', async () => {
			const owner = await createTestAccount(harness);
			await grantPremium(harness, owner.userId, UserPremiumTypes.LIFETIME);

			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const initialApp = await getOAuth2Application(harness, owner.token, app.application.id);
			const initialDiscriminator = initialApp.bot?.discriminator;
			expect(initialDiscriminator).toBeTruthy();

			const {response, text} = await createBuilder(harness, owner.token)
				.patch(`/oauth2/applications/${app.application.id}/bot`)
				.body({
					discriminator: 0,
				})
				.executeRaw();

			expect(response.status).toBe(400);
			expect(text).toContain(ValidationErrorCodes.BOT_DISCRIMINATOR_CANNOT_BE_CHANGED);

			const afterApp = await getOAuth2Application(harness, owner.token, app.application.id);
			expect(afterApp.bot?.discriminator).toBe(initialDiscriminator);
		});
	});

	describe('Bot username case change', () => {
		test('case-only username change preserves discriminator', async () => {
			const owner = await createTestAccount(harness);
			const initialUsername = `testbot${Date.now() % 10000}`;
			const app = await createOAuth2Application(harness, owner.token, {
				name: initialUsername,
				redirect_uris: ['https://example.com/callback'],
			});

			const initialApp = await getOAuth2Application(harness, owner.token, app.application.id);
			const initialDiscriminator = initialApp.bot?.discriminator;
			expect(initialDiscriminator).toBeTruthy();

			const uppercaseUsername = initialApp.bot!.username.toUpperCase();
			const updatedBot = await createBuilder<ApplicationBotResponse>(harness, owner.token)
				.patch(`/oauth2/applications/${app.application.id}/bot`)
				.body({
					username: uppercaseUsername,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updatedBot.username).toBe(uppercaseUsername);
			expect(updatedBot.discriminator).toBe(initialDiscriminator);
		});

		test('mixed case username change preserves discriminator', async () => {
			const owner = await createTestAccount(harness);
			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const initialApp = await getOAuth2Application(harness, owner.token, app.application.id);
			const initialDiscriminator = initialApp.bot?.discriminator;
			const initialUsername = initialApp.bot!.username;

			let mixedCaseUsername = '';
			for (let i = 0; i < initialUsername.length; i++) {
				const char = initialUsername[i]!;
				if (i % 2 === 0) {
					mixedCaseUsername += char.toUpperCase();
				} else {
					mixedCaseUsername += char.toLowerCase();
				}
			}

			const updatedBot = await createBuilder<ApplicationBotResponse>(harness, owner.token)
				.patch(`/oauth2/applications/${app.application.id}/bot`)
				.body({
					username: mixedCaseUsername,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(updatedBot.username).toBe(mixedCaseUsername);
			expect(updatedBot.discriminator).toBe(initialDiscriminator);
		});
	});

	describe('Bot guild add', () => {
		test('bot can be added to guild by owner with MANAGE_GUILD', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Bot Guild Test');

			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
				bot_public: true,
			});

			await createBuilder(harness, owner.token)
				.post('/oauth2/authorize/consent')
				.body({
					client_id: app.application.id,
					scope: 'bot',
					guild_id: guild.id,
					permissions: Permissions.SEND_MESSAGES.toString(),
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const botMember = await getMember(harness, owner.token, guild.id, app.botUserId);
			expect(botMember.user?.id).toBe(app.botUserId);
			expect(botMember.roles.length).toBeGreaterThan(0);
		});

		test('bot gets role with specified permissions when added to guild', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Bot Permissions Guild');

			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
				bot_public: true,
			});

			const requestedPermissions = Permissions.SEND_MESSAGES | Permissions.READ_MESSAGE_HISTORY;
			await createBuilder(harness, owner.token)
				.post('/oauth2/authorize/consent')
				.body({
					client_id: app.application.id,
					scope: 'bot',
					guild_id: guild.id,
					permissions: requestedPermissions.toString(),
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const botMember = await getMember(harness, owner.token, guild.id, app.botUserId);
			expect(botMember.roles.length).toBeGreaterThan(0);
		});
	});

	describe('Bot token invalidation', () => {
		test('old bot token is invalidated after reset', async () => {
			const owner = await createTestAccount(harness);
			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const oldToken = app.botToken;

			await createBuilder(harness, `Bot ${oldToken}`).get('/users/@me').expect(HTTP_STATUS.OK).execute();

			const resetResult = await createBuilder<{token: string}>(harness, owner.token)
				.post(`/oauth2/applications/${app.application.id}/bot/reset-token`)
				.body({
					password: owner.password,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(resetResult.token).toBeTruthy();
			expect(resetResult.token).not.toBe(oldToken);

			await createBuilder(harness, `Bot ${oldToken}`).get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();

			await createBuilder(harness, `Bot ${resetResult.token}`).get('/users/@me').expect(HTTP_STATUS.OK).execute();
		});

		test('invalid bot token format is rejected', async () => {
			const invalidTokens = ['', 'not-a-real-token', 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAuR0ZVa2Ry.dQw4w9WgXcQ'];

			for (const invalidToken of invalidTokens) {
				await createBuilder(harness, `Bot ${invalidToken}`)
					.get('/users/@me')
					.expect(HTTP_STATUS.UNAUTHORIZED)
					.execute();
			}
		});
	});

	describe('Bot MFA state', () => {
		test('bot inherits MFA state from owner after TOTP enabled', async () => {
			const owner = await createTestAccount(harness);
			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const botUserBefore = await createBuilder<{
				mfa_enabled: boolean;
				authenticator_types?: Array<number>;
			}>(harness, `Bot ${app.botToken}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(botUserBefore.mfa_enabled).toBe(false);

			const secret = createTotpSecret();
			await createBuilder(harness, owner.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: totpCodeNow(secret),
					password: owner.password,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const botUserAfter = await createBuilder<{mfa_enabled: boolean; authenticator_types?: Array<number>}>(
				harness,
				`Bot ${app.botToken}`,
			)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(botUserAfter.mfa_enabled).toBe(true);
			expect(botUserAfter.authenticator_types).toContain(0);
		});

		test('new bot inherits existing MFA state from owner', async () => {
			const owner = await createTestAccount(harness);

			const secret = createTotpSecret();
			await createBuilder(harness, owner.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: totpCodeNow(secret),
					password: owner.password,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const botUser = await createBuilder<{mfa_enabled: boolean; authenticator_types?: Array<number>}>(
				harness,
				`Bot ${app.botToken}`,
			)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(botUser.mfa_enabled).toBe(true);
			expect(botUser.authenticator_types).toContain(0);
		});
	});

	describe('Bot unknown permission bits', () => {
		test('adding bot ignores unknown permission bits', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Unknown Bits Guild');

			const app = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
				bot_public: true,
			});

			const manageGuild = 1n << 5n;
			const unknownBit = 1n << 60n;
			const combinedPermissions = manageGuild | unknownBit;

			await createBuilder(harness, owner.token)
				.post('/oauth2/authorize/consent')
				.body({
					client_id: app.application.id,
					scope: 'bot',
					guild_id: guild.id,
					permissions: combinedPermissions.toString(),
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const botMember = await getMember(harness, owner.token, guild.id, app.botUserId);
			expect(botMember.roles.length).toBeGreaterThan(0);

			const roles = await getRoles(harness, owner.token, guild.id);

			let botRole = null;
			for (const role of roles) {
				for (const memberRoleId of botMember.roles) {
					if (role.id === memberRoleId && role.id !== guild.id) {
						botRole = role;
						break;
					}
				}
				if (botRole) break;
			}

			expect(botRole).not.toBeNull();

			const rolePermissions = BigInt(botRole!.permissions);
			const hasUnknownBit = (rolePermissions & unknownBit) !== 0n;
			expect(hasUnknownBit).toBe(false);

			const hasManageGuild = (rolePermissions & manageGuild) === manageGuild;
			expect(hasManageGuild).toBe(true);
		});
	});
});
