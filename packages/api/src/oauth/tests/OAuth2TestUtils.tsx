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
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {ApplicationResponse} from '@fluxer/schema/src/domains/oauth/OAuthSchemas';

export interface OAuth2CreateResult {
	application: ApplicationResponse;
	clientSecret: string;
	botUserId: string;
	botToken: string;
}

export async function createOAuth2Application(
	harness: ApiTestHarness,
	token: string,
	params: {
		name: string;
		redirect_uris?: Array<string> | null;
		bot_public?: boolean;
		bot_require_code_grant?: boolean;
	},
): Promise<OAuth2CreateResult> {
	const body = {
		name: params.name,
		redirect_uris: params.redirect_uris ?? [],
		...(params.bot_public !== undefined && {bot_public: params.bot_public}),
		...(params.bot_require_code_grant !== undefined && {bot_require_code_grant: params.bot_require_code_grant}),
	};

	const {response, text, json} = await createBuilder<ApplicationResponse>(harness, token)
		.post('/oauth2/applications')
		.body(body)
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	if (!json.id) {
		throw new Error('Application response missing id');
	}

	if (!json.bot?.id || !json.bot?.token) {
		throw new Error('Application response missing bot id or token');
	}

	if (!json.client_secret) {
		throw new Error('Application response missing client_secret');
	}

	return {
		application: json,
		clientSecret: json.client_secret,
		botUserId: json.bot.id,
		botToken: json.bot.token,
	};
}

export async function getOAuth2Application(
	harness: ApiTestHarness,
	token: string,
	applicationId: string,
): Promise<ApplicationResponse> {
	const {response, text, json} = await createBuilder<ApplicationResponse>(harness, token)
		.get(`/oauth2/applications/${applicationId}`)
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	return json;
}

export async function listOAuth2Applications(
	harness: ApiTestHarness,
	token: string,
): Promise<Array<ApplicationResponse>> {
	const {response, text, json} = await createBuilder<Array<ApplicationResponse>>(harness, token)
		.get('/oauth2/applications/@me')
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	return json;
}

export async function updateOAuth2Application(
	harness: ApiTestHarness,
	token: string,
	applicationId: string,
	params: {
		name?: string;
		redirect_uris?: Array<string> | null;
		bot_public?: boolean;
		bot_require_code_grant?: boolean;
	},
): Promise<ApplicationResponse> {
	const {response, text, json} = await createBuilder<ApplicationResponse>(harness, token)
		.patch(`/oauth2/applications/${applicationId}`)
		.body(params)
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	return json;
}

export async function deleteOAuth2Application(
	harness: ApiTestHarness,
	token: string,
	applicationId: string,
	password: string,
): Promise<void> {
	const {response, text} = await createBuilder(harness, token)
		.delete(`/oauth2/applications/${applicationId}`)
		.body({password})
		.executeRaw();

	if (response.status !== 204) {
		throw new Error(`Expected 204, got ${response.status}: ${text}`);
	}
}

export function createUniqueApplicationName(prefix = 'Test App'): string {
	return `${prefix} ${randomUUID()}`;
}

export function generateBotToken(): string {
	const randomPart = randomUUID().replace(/-/g, '');
	return `MT${randomPart}`;
}

export interface OAuth2TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	scope?: string;
}

export interface OAuth2IntrospectionResponse {
	active: boolean;
	client_id: string;
	scope?: string;
}

export interface OAuth2UserInfoResponse {
	sub: string;
	[key: string]: unknown;
}

export interface OAuth2AuthorizationResponse {
	application: ApplicationResponse;
	scopes: Array<string>;
	authorized_at: string;
}

export interface OAuth2ConsentResponse {
	redirect_to: string;
}

export async function authorizeOAuth2(
	harness: ApiTestHarness,
	userToken: string,
	params: {
		client_id: string;
		redirect_uri: string;
		scope: Array<string>;
		state?: string;
	},
): Promise<{code: string; state: string}> {
	const state = params.state ?? `state-${randomUUID()}`;
	const scope = params.scope.join(' ');

	const {response, text, json} = await createBuilder<OAuth2ConsentResponse>(harness, userToken)
		.post('/oauth2/authorize/consent')
		.body({
			response_type: 'code',
			client_id: params.client_id,
			redirect_uri: params.redirect_uri,
			scope: scope,
			state: state,
		})
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	if (!json.redirect_to) {
		throw new Error('Authorization response missing redirect_to');
	}

	const redirectUrl = new URL(json.redirect_to);
	const code = redirectUrl.searchParams.get('code');
	const returnedState = redirectUrl.searchParams.get('state');

	if (!code) {
		throw new Error('Redirect missing authorization code');
	}

	return {code, state: returnedState ?? ''};
}

export async function exchangeOAuth2AuthorizationCode(
	harness: ApiTestHarness,
	params: {
		client_id: string;
		client_secret: string;
		code: string;
		redirect_uri: string;
	},
): Promise<OAuth2TokenResponse> {
	const formParams = new URLSearchParams({
		grant_type: 'authorization_code',
		code: params.code,
		redirect_uri: params.redirect_uri,
		client_id: params.client_id,
	});

	const {response, text} = await createBuilder<OAuth2TokenResponse>(harness, '')
		.post('/oauth2/token')
		.header('content-type', 'application/x-www-form-urlencoded')
		.header('Authorization', `Basic ${btoa(`${params.client_id}:${params.client_secret}`)}`)
		.body(formParams.toString())
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	const token = JSON.parse(text) as OAuth2TokenResponse;
	if (!token.access_token) {
		throw new Error('OAuth2 token response missing access_token');
	}

	return token;
}

export async function getOAuth2UserInfo(harness: ApiTestHarness, accessToken: string): Promise<OAuth2UserInfoResponse> {
	const {response, text, json} = await createBuilder<OAuth2UserInfoResponse>(harness, `Bearer ${accessToken}`)
		.get('/oauth2/userinfo')
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	return json;
}

export async function introspectOAuth2Token(
	harness: ApiTestHarness,
	params: {
		client_id: string;
		client_secret: string;
		token: string;
	},
): Promise<OAuth2IntrospectionResponse> {
	const formParams = new URLSearchParams({
		token: params.token,
	});

	const {response, text} = await createBuilder<OAuth2IntrospectionResponse>(harness, '')
		.post('/oauth2/introspect')
		.header('content-type', 'application/x-www-form-urlencoded')
		.header('Authorization', `Basic ${btoa(`${params.client_id}:${params.client_secret}`)}`)
		.body(formParams.toString())
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	return JSON.parse(text) as OAuth2IntrospectionResponse;
}

export async function listOAuth2Authorizations(
	harness: ApiTestHarness,
	userToken: string,
): Promise<Array<OAuth2AuthorizationResponse>> {
	const {response, text, json} = await createBuilder<Array<OAuth2AuthorizationResponse>>(harness, userToken)
		.get('/oauth2/@me/authorizations')
		.executeRaw();

	if (response.status !== 200) {
		throw new Error(`Expected 200, got ${response.status}: ${text}`);
	}

	return json;
}

export async function deauthorizeOAuth2Application(
	harness: ApiTestHarness,
	userToken: string,
	applicationId: string,
): Promise<void> {
	const {response, text} = await createBuilder(harness, userToken)
		.delete(`/oauth2/@me/authorizations/${applicationId}`)
		.executeRaw();

	if (response.status !== 204) {
		throw new Error(`Expected 204, got ${response.status}: ${text}`);
	}
}
