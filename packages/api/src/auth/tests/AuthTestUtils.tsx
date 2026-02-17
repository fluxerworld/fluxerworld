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

import {createHmac, randomBytes, randomUUID} from 'node:crypto';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {generateUniquePassword, TEST_CREDENTIALS, TEST_USER_DATA} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {decode as base32Decode, encode as base32Encode} from 'hi-base32';
import {expect} from 'vitest';

export interface RegisterResponse {
	user_id: string;
	token: string;
}

export interface LoginSuccessResponse {
	user_id: string;
	token: string;
}

export interface LoginMfaResponse {
	mfa: true;
	ticket: string;
	allowed_methods: Array<string>;
	sms_phone_hint: string | null;
	sms: boolean;
	totp: boolean;
	webauthn: boolean;
}

export type LoginResponse =
	| {user_id: string; token: string}
	| {
			mfa: true;
			ticket: string;
			allowed_methods: Array<string>;
			sms_phone_hint: string | null;
			sms: boolean;
			totp: boolean;
			webauthn: boolean;
	  };

export interface UserMeResponse {
	id: string;
	email: string | null;
	username: string;
	global_name: string | null;
}

export interface UserSettingsResponse {
	incoming_call_flags: number;
}

export interface TestEmailRecord {
	to: string;
	subject: string;
	type: string;
	timestamp: string;
	metadata: Record<string, string>;
}

export interface TestAccount {
	email: string;
	password: string;
	userId: string;
	token: string;
	username?: string;
}

export function createUniqueEmail(prefix = 'integration'): string {
	return `${prefix}-${randomUUID()}@example.com`;
}

export function createUniqueUsername(prefix = 'itest'): string {
	return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export async function createAuthHarness(): Promise<ApiTestHarness> {
	return await createApiTestHarness();
}

export async function registerUser(harness: ApiTestHarness, body: Record<string, unknown>): Promise<RegisterResponse> {
	return createBuilder<RegisterResponse>(harness, '').post('/auth/register').body(body).execute();
}

export async function createTestAccount(
	harness: ApiTestHarness,
	params?: {
		email?: string;
		password?: string;
		username?: string;
		globalName?: string;
		dateOfBirth?: string;
		skipSessionStart?: boolean;
	},
): Promise<TestAccount> {
	const email = params?.email ?? createUniqueEmail('account');
	const password = params?.password ?? TEST_CREDENTIALS.STRONG_PASSWORD;
	const username = params?.username ?? createUniqueUsername('account');
	const reg = await registerUser(harness, {
		email,
		username,
		global_name: params?.globalName ?? TEST_USER_DATA.DEFAULT_GLOBAL_NAME,
		password,
		date_of_birth: params?.dateOfBirth ?? TEST_USER_DATA.DEFAULT_DATE_OF_BIRTH,
		consent: true,
	});

	if (!params?.skipSessionStart) {
		const HAS_SESSION_STARTED = BigInt(1) << BigInt(39);
		await createBuilder<unknown>(harness, reg.token)
			.patch(`/test/users/${reg.user_id}/flags`)
			.body({
				flags: HAS_SESSION_STARTED.toString(),
			})
			.execute();
	}

	return {email, password, userId: reg.user_id, token: reg.token, username};
}

export async function loginUser(
	harness: ApiTestHarness,
	body: {email: string; password: string; invite_code?: string | null},
): Promise<LoginResponse> {
	return createBuilder<LoginResponse>(harness, '').post('/auth/login').body(body).execute();
}

export async function loginAccount(harness: ApiTestHarness, account: TestAccount): Promise<TestAccount> {
	const login = await loginUser(harness, {email: account.email, password: account.password});
	if ('mfa' in login) {
		throw new Error('Expected non-MFA login for test account');
	}
	const {token, user_id} = login as {user_id: string; token: string};
	return {...account, token, userId: user_id};
}

export async function fetchMe(
	harness: ApiTestHarness,
	token: string,
	expectedStatus: 200 | 401 = 200,
): Promise<{response: Response; json: unknown}> {
	const {response, json} = await createBuilder(harness, token).get('/users/@me').expect(expectedStatus).executeRaw();
	return {response, json};
}

export async function fetchSettings(
	harness: ApiTestHarness,
	token: string,
	expectedStatus: 200 | 401 = 200,
): Promise<{response: Response; json: unknown}> {
	const {response, json} = await createBuilder(harness, token)
		.get('/users/@me/settings')
		.expect(expectedStatus)
		.executeRaw();
	return {response, json};
}

export async function listTestEmails(
	harness: ApiTestHarness,
	params?: {recipient?: string},
): Promise<Array<TestEmailRecord>> {
	const query = params?.recipient ? `?recipient=${encodeURIComponent(params.recipient)}` : '';
	const response = await createBuilder<{emails: Array<TestEmailRecord>}>(harness, '')
		.get(`/test/emails${query}`)
		.execute();
	return response.emails;
}

export async function clearTestEmails(harness: ApiTestHarness): Promise<void> {
	await createBuilder(harness, '').delete('/test/emails').expect(204).execute();
}

export function findLastTestEmail(emails: Array<TestEmailRecord>, type: string): TestEmailRecord | null {
	for (let i = emails.length - 1; i >= 0; i--) {
		const email = emails[i];
		if (email?.type === type) return email;
	}
	return null;
}

export function titleCaseEmail(email: string): string {
	return email
		.toLowerCase()
		.replace(/(^|[.@])([a-z])/g, (_match, prefix: string, char: string) => `${prefix}${char.toUpperCase()}`);
}

export interface BackupCodesResponse {
	backup_codes: Array<{code: string}>;
}

export interface MfaLoginResponse {
	token: string;
}

export interface PhoneVerifyResponse {
	phone: string;
	verified: boolean;
	phone_token: string;
}

export function createTotpSecret(): string {
	const buf = randomBytes(20);
	return base32Encode(buf).replace(/=/g, '');
}

export function generateTotpCode(secret: string, time = Date.now()): string {
	const key = Buffer.from(base32Decode.asBytes(secret.toUpperCase()));
	const epoch = Math.floor(time / 1000);
	const counter = Math.floor(epoch / 30);
	const counterBuf = Buffer.alloc(8);
	counterBuf.writeBigUInt64BE(BigInt(counter));

	const hmac = createHmac('sha1', key);
	hmac.update(counterBuf);
	const hash = hmac.digest();

	const offset = hash[hash.length - 1] & 0x0f;
	const binary =
		((hash[offset]! & 0x7f) << 24) |
		((hash[offset + 1]! & 0xff) << 16) |
		((hash[offset + 2]! & 0xff) << 8) |
		(hash[offset + 3]! & 0xff);

	const otp = binary % 1_000_000;
	return otp.toString().padStart(6, '0');
}

export function totpCodeNow(secret: string): string {
	return generateTotpCode(secret, Date.now());
}

export function totpCodeNext(secret: string): string {
	return generateTotpCode(secret, Date.now() + 30000);
}

export async function seedMfaTicket(
	harness: ApiTestHarness,
	ticket: string,
	userId: string,
	ttlSeconds: number,
): Promise<void> {
	await createBuilder(harness, '')
		.post('/test/auth/mfa-ticket')
		.body({
			ticket,
			user_id: userId,
			ttl_seconds: ttlSeconds,
		})
		.execute();
}

export async function setUserACLs(
	harness: ApiTestHarness,
	account: TestAccount,
	acls: Array<string>,
): Promise<TestAccount> {
	await createBuilder(harness, `Bearer ${account.token}`)
		.post(`/test/users/${account.userId}/acls`)
		.body({acls})
		.execute();
	return await loginAccount(harness, account);
}

export async function unclaimAccount(harness: ApiTestHarness, userId: string): Promise<void> {
	await createBuilder(harness, '').post(`/test/users/${userId}/unclaim`).body(null).execute();
}

export interface SsoConfig {
	enabled: boolean;
	authorization_url: string;
	token_url: string;
	client_id: string;
	client_secret: string;
	scope: string;
	allowed_domains: Array<string>;
	auto_provision: boolean;
	redirect_uri: string;
	display_name?: string;
}

export async function enableSso(
	harness: ApiTestHarness,
	token: string,
	overrides: Partial<SsoConfig> = {},
): Promise<void> {
	const ssoConfig: SsoConfig = {
		enabled: true,
		authorization_url: 'test',
		token_url: 'test',
		client_id: 'itest-client',
		client_secret: '',
		scope: 'openid email profile',
		allowed_domains: ['example.com'],
		auto_provision: true,
		redirect_uri: '',
		...overrides,
	};

	await createBuilder(harness, token).post('/admin/instance-config/update').body({sso: ssoConfig}).execute();
}

export async function disableSso(harness: ApiTestHarness, token: string): Promise<void> {
	await createBuilder(harness, token)
		.post('/admin/instance-config/update')
		.body({
			sso: {
				enabled: false,
			},
		})
		.execute();
}

export async function verifyTokenValid(harness: ApiTestHarness, token: string): Promise<boolean> {
	const {response} = await createBuilder(harness, token).get('/users/@me').executeWithResponse();
	return response.status === 200;
}

export async function verifySessionInvalidated(harness: ApiTestHarness, token: string): Promise<boolean> {
	const valid = await verifyTokenValid(harness, token);
	return !valid;
}

export async function createSessionFromLogin(harness: ApiTestHarness, account: TestAccount): Promise<string> {
	const login = await loginUser(harness, {email: account.email, password: account.password});
	if ('mfa' in login && login.mfa) {
		throw new Error('Expected non-MFA login for test account');
	}
	const nonMfaLogin = login as {user_id: string; token: string};
	return nonMfaLogin.token;
}

export async function listSessions(harness: ApiTestHarness, token: string): Promise<Array<{id: string}>> {
	return createBuilder<Array<{id: string}>>(harness, token).get('/auth/sessions').execute();
}

export async function logoutSession(harness: ApiTestHarness, token: string): Promise<void> {
	await createBuilder(harness, token).post('/auth/logout').expect(204).execute();
}

export async function changePassword(
	harness: ApiTestHarness,
	token: string,
	oldPassword: string,
	newPassword: string,
): Promise<void> {
	await createBuilder(harness, token)
		.patch('/users/@me')
		.body({
			password: oldPassword,
			new_password: newPassword,
		})
		.execute();
}

export async function requestPasswordReset(harness: ApiTestHarness, email: string): Promise<void> {
	const {response} = await createBuilder(harness, '').post('/auth/forgot').body({email}).executeWithResponse();
	if (response.status !== 204 && response.status !== 200 && response.status !== 202) {
		throw new Error(`Expected 204/200/202 for password reset request, got ${response.status}`);
	}
}

export async function resetPassword(
	harness: ApiTestHarness,
	token: string,
	newPassword: string,
): Promise<LoginSuccessResponse> {
	return createBuilder<LoginSuccessResponse>(harness, '')
		.post('/auth/reset')
		.body({token, password: newPassword})
		.execute();
}

export function generateStrongPassword(): string {
	return generateUniquePassword();
}

export function createFakeAuthToken(): string {
	const randomPart = Array.from({length: 36}, () => {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		return chars[Math.floor(Math.random() * chars.length)];
	}).join('');
	return `flx_${randomPart}`;
}

export async function assertLoginFails(harness: ApiTestHarness, email: string, password: string): Promise<void> {
	const {response} = await createBuilder(harness, '').post('/auth/login').body({email, password}).executeWithResponse();
	expect(response.status).toBe(400);
}

export async function assertEndpointProtected(harness: ApiTestHarness, path: string): Promise<void> {
	const {response} = await createBuilder(harness, '').get(path).executeWithResponse();
	expect(response.status).toBe(401);
}

export async function logoutSpecificSessions(
	harness: ApiTestHarness,
	token: string,
	sessionIdHashes: Array<string>,
	password: string,
): Promise<void> {
	await createBuilder(harness, token)
		.post('/auth/sessions/logout')
		.body({
			session_id_hashes: sessionIdHashes,
			password,
		})
		.expect(204)
		.execute();
}
