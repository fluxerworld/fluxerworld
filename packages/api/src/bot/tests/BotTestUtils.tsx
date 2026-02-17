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

import {randomUUID} from 'node:crypto';
import {createUniqueEmail, createUniqueUsername, registerUser} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {ApplicationResponse} from '@fluxer/schema/src/domains/oauth/OAuthSchemas';

export interface BotAccount {
	userId: string;
	token: string;
}

export interface TestBotAccount {
	appId: string;
	botUserId: string;
	botToken: string;
	clientSecret: string;
	ownerEmail: string;
	ownerPassword: string;
	ownerUserId: string;
	ownerToken: string;
}

export async function createTestAccount(harness: ApiTestHarness): Promise<{
	email: string;
	password: string;
	userId: string;
	token: string;
}> {
	const email = createUniqueEmail('bot_owner');
	const username = createUniqueUsername('bot_owner');
	const password = 'BotOwnerPassword123!';

	const reg = await registerUser(harness, {
		email,
		username,
		global_name: 'Bot Owner',
		password,
		date_of_birth: '2000-01-01',
		consent: true,
	});

	return {email, password, userId: reg.user_id, token: reg.token};
}

export async function createOAuth2BotApplication(
	harness: ApiTestHarness,
	ownerToken: string,
	name: string,
	redirectURIs: Array<string> = [],
): Promise<{appId: string; botUserId: string; botToken: string; clientSecret: string}> {
	const app = await createBuilder<ApplicationResponse>(harness, ownerToken)
		.post('/oauth2/applications')
		.body({
			name,
			redirect_uris: redirectURIs,
		})
		.execute();

	if (!app.id || !app.client_secret || !app.bot?.id || !app.bot?.token) {
		throw new Error('Application response missing required fields');
	}

	return {
		appId: app.id,
		botUserId: app.bot.id,
		botToken: app.bot.token,
		clientSecret: app.client_secret,
	};
}

export async function createTestBotAccount(
	harness: ApiTestHarness,
	params?: {
		appName?: string;
		redirectURIs?: Array<string>;
	},
): Promise<TestBotAccount> {
	const owner = await createTestAccount(harness);
	const appName = params?.appName ?? `Test Bot ${randomUUID()}`;

	const botApp = await createOAuth2BotApplication(harness, owner.token, appName, params?.redirectURIs);

	return {
		appId: botApp.appId,
		botUserId: botApp.botUserId,
		botToken: botApp.botToken,
		clientSecret: botApp.clientSecret,
		ownerEmail: owner.email,
		ownerPassword: owner.password,
		ownerUserId: owner.userId,
		ownerToken: owner.token,
	};
}

export async function authenticateWithBotToken(
	harness: ApiTestHarness,
	botToken: string,
): Promise<{userId: string; username: string}> {
	const me = await createBuilder<{id: string; username: string}>(harness, `Bot ${botToken}`)
		.get('/users/@me')
		.execute();

	if (!me.id || !me.username) {
		throw new Error('User response missing required fields');
	}

	return {userId: me.id, username: me.username};
}

export async function resetBotToken(
	harness: ApiTestHarness,
	ownerToken: string,
	appId: string,
	password?: string,
): Promise<string> {
	const body: Record<string, unknown> = {};
	if (password !== undefined) {
		body.password = password;
	}

	const result = await createBuilder<{token: string}>(harness, ownerToken)
		.post(`/oauth2/applications/${appId}/bot/reset-token`)
		.body(body)
		.execute();

	if (!result.token) {
		throw new Error('Token reset response missing token');
	}

	return result.token;
}

export async function getGatewayBot(
	harness: ApiTestHarness,
	botToken: string,
): Promise<{
	url: string | null;
	shards: number | null;
}> {
	const gateway = await createBuilder<{url?: string; shards?: number}>(harness, `Bot ${botToken}`)
		.get('/gateway/bot')
		.expect(404)
		.execute();

	return {
		url: gateway.url ?? null,
		shards: gateway.shards ?? null,
	};
}

export async function authorizeBot(
	harness: ApiTestHarness,
	userToken: string,
	clientId: string,
	scopes: Array<string>,
	guildId?: string,
	permissions?: string,
): Promise<{redirectUrl: string}> {
	const body: Record<string, unknown> = {
		client_id: clientId,
		scope: scopes.join(' '),
	};

	if (guildId) {
		body.guild_id = guildId;
	}

	if (permissions) {
		body.permissions = permissions;
	}

	const consent = await createBuilder<{redirect_to: string}>(harness, userToken)
		.post('/oauth2/authorize/consent')
		.body(body)
		.execute();

	if (!consent.redirect_to) {
		throw new Error('Authorization response missing redirect_to');
	}

	return {redirectUrl: consent.redirect_to};
}
