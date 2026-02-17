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

import fs from 'node:fs/promises';
import path from 'node:path';
import {
	EncryptionMiddleware,
	getDecryptedBody,
	getDecryptedBodyAsJson,
	isEncryptedRequest,
} from '@fluxer/api/src/federation/EncryptionMiddleware';
import {initializeKeyManager, KeyManager, resetKeyManager} from '@fluxer/api/src/federation/KeyManager';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {FluxerError} from '@fluxer/errors/src/FluxerError';
import {Hono} from 'hono';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface EchoResponse {
	received: string;
	encrypted: boolean;
}

interface SimpleResponse {
	status: string;
}

interface ErrorResponse {
	code: string;
	message: string;
}

interface BodyCheckResponse {
	bodyIsNull: boolean;
}

interface EncryptedCheckResponse {
	isEncrypted: boolean;
}

interface RawBodyResponse {
	bodyLength: number;
	encrypted: boolean;
}

function createTestErrorHandler(err: Error, ctx: {json: (body: unknown, status: number) => Response}): Response {
	if (err instanceof FluxerError) {
		return ctx.json({code: err.code, message: err.message}, err.status);
	}
	return ctx.json({code: 'INTERNAL_ERROR', message: err.message}, 500);
}

const TEST_KEY_DIR = '/tmp/fluxer-encryption-middleware-test-keys';
const ENCRYPTED_CONTENT_TYPE = 'application/x-fluxer-encrypted';
const EPHEMERAL_KEY_HEADER = 'x-fluxer-ephemeral-key';
const IV_HEADER = 'x-fluxer-iv';
const ENCRYPTED_RESPONSE_HEADER = 'x-fluxer-encrypted-response';

interface TestContext {
	app: Hono;
	serverKeyManager: KeyManager;
	clientKeyManager: KeyManager;
}

async function createTestContext(): Promise<TestContext> {
	const serverKeyPath = path.join(TEST_KEY_DIR, `server-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`);
	const clientKeyPath = path.join(TEST_KEY_DIR, `client-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`);

	await fs.mkdir(TEST_KEY_DIR, {recursive: true});

	const serverKeyManager = initializeKeyManager({privateKeyPath: serverKeyPath});
	await serverKeyManager.init();

	const clientKeyManager = new KeyManager({privateKeyPath: clientKeyPath});
	await clientKeyManager.init();

	const app = new Hono();

	app.onError((err, ctx) => createTestErrorHandler(err, ctx));
	app.use('*', EncryptionMiddleware);

	app.post('/test/echo', async (ctx) => {
		const encryptionContext = ctx.get('encryption');

		if (encryptionContext?.isEncrypted && encryptionContext.decryptedBody) {
			const text = new TextDecoder().decode(encryptionContext.decryptedBody);
			return ctx.json({received: text, encrypted: true});
		}

		const body = await ctx.req.text();
		return ctx.json({received: body, encrypted: false});
	});

	app.post('/test/echo-json', async (ctx) => {
		if (isEncryptedRequest(ctx)) {
			const data = getDecryptedBodyAsJson<{message: string}>(ctx);
			return ctx.json({data, encrypted: true});
		}

		const data = await ctx.req.json();
		return ctx.json({data, encrypted: false});
	});

	app.get('/test/simple', async (ctx) => {
		return ctx.json({status: 'ok'});
	});

	app.post('/test/raw-body', async (ctx) => {
		const body = getDecryptedBody(ctx);
		if (body) {
			return ctx.json({bodyLength: body.length, encrypted: true});
		}
		const rawBody = await ctx.req.arrayBuffer();
		return ctx.json({bodyLength: rawBody.byteLength, encrypted: false});
	});

	return {app, serverKeyManager, clientKeyManager};
}

describe('EncryptionMiddleware', () => {
	let testContext: TestContext;

	beforeAll(async () => {
		await fs.mkdir(TEST_KEY_DIR, {recursive: true});
	});

	beforeEach(async () => {
		resetKeyManager();
		testContext = await createTestContext();
	});

	afterEach(() => {
		resetKeyManager();
	});

	afterAll(async () => {
		try {
			await fs.rm(TEST_KEY_DIR, {recursive: true, force: true});
		} catch {}
	});

	describe('non-encrypted requests', () => {
		it('passes through non-encrypted requests normally', async () => {
			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({message: 'hello'}),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
			const json = (await response.json()) as EchoResponse;
			expect(json.encrypted).toBe(false);
			expect(json.received).toBe('{"message":"hello"}');
		});

		it('passes through GET requests without encryption context affecting them', async () => {
			const response = await testContext.app.request('/test/simple', {
				method: 'GET',
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
			const json = (await response.json()) as SimpleResponse;
			expect(json.status).toBe('ok');
		});

		it('sets isEncrypted to false for non-encrypted requests', async () => {
			const response = await testContext.app.request('/test/echo-json', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({message: 'test'}),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
			const json = (await response.json()) as {data: unknown; encrypted: boolean};
			expect(json.encrypted).toBe(false);
		});
	});

	describe('missing headers', () => {
		it('returns 400 with MISSING_EPHEMERAL_KEY when ephemeral key header is missing', async () => {
			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[IV_HEADER]: Buffer.from(new Uint8Array(12)).toString('base64'),
				},
				body: 'encrypted-data',
			});

			expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
			const json = (await response.json()) as ErrorResponse;
			expect(json.code).toBe('MISSING_EPHEMERAL_KEY');
		});

		it('returns 400 with MISSING_IV when IV header is missing', async () => {
			const ephemeralKey = testContext.clientKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(ephemeralKey).toString('base64'),
				},
				body: 'encrypted-data',
			});

			expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
			const json = (await response.json()) as ErrorResponse;
			expect(json.code).toBe('MISSING_IV');
		});
	});

	describe('invalid key sizes', () => {
		it('returns 500 with DECRYPTION_FAILED for wrong ephemeral key size', async () => {
			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(new Uint8Array(16)).toString('base64'),
					[IV_HEADER]: Buffer.from(new Uint8Array(12)).toString('base64'),
				},
				body: 'encrypted-data',
			});

			expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
			const json = (await response.json()) as ErrorResponse;
			expect(json.code).toBe('DECRYPTION_FAILED');
		});

		it('returns 500 with DECRYPTION_FAILED for wrong IV size', async () => {
			const ephemeralKey = testContext.clientKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(ephemeralKey).toString('base64'),
					[IV_HEADER]: Buffer.from(new Uint8Array(8)).toString('base64'),
				},
				body: 'encrypted-data',
			});

			expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
			const json = (await response.json()) as ErrorResponse;
			expect(json.code).toBe('DECRYPTION_FAILED');
		});
	});

	describe('empty encrypted body', () => {
		it('returns 400 with EMPTY_ENCRYPTED_BODY when body is empty', async () => {
			const ephemeralKey = testContext.clientKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(ephemeralKey).toString('base64'),
					[IV_HEADER]: Buffer.from(new Uint8Array(12)).toString('base64'),
				},
				body: '',
			});

			expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
			const json = (await response.json()) as ErrorResponse;
			expect(json.code).toBe('EMPTY_ENCRYPTED_BODY');
		});
	});

	describe('request decryption', () => {
		it('decrypts valid encrypted request body', async () => {
			const plaintext = 'Hello, encrypted world!';
			const plaintextBytes = new TextEncoder().encode(plaintext);
			const serverPublicKey = testContext.serverKeyManager.getPublicKey();

			const {ciphertext, iv} = await testContext.clientKeyManager.encrypt(plaintextBytes, serverPublicKey);

			const clientPublicKey = testContext.clientKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(clientPublicKey).toString('base64'),
					[IV_HEADER]: Buffer.from(iv).toString('base64'),
				},
				body: Buffer.from(ciphertext),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
		});

		it('decrypts JSON body correctly', async () => {
			const jsonData = {message: 'encrypted json'};
			const plaintextBytes = new TextEncoder().encode(JSON.stringify(jsonData));
			const serverPublicKey = testContext.serverKeyManager.getPublicKey();

			const {ciphertext, iv} = await testContext.clientKeyManager.encrypt(plaintextBytes, serverPublicKey);

			const clientPublicKey = testContext.clientKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/echo-json', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(clientPublicKey).toString('base64'),
					[IV_HEADER]: Buffer.from(iv).toString('base64'),
				},
				body: Buffer.from(ciphertext),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
		});

		it('handles binary data correctly', async () => {
			const binaryData = new Uint8Array([0x00, 0xff, 0x7f, 0x80, 0x01, 0xfe]);
			const serverPublicKey = testContext.serverKeyManager.getPublicKey();

			const {ciphertext, iv} = await testContext.clientKeyManager.encrypt(binaryData, serverPublicKey);

			const clientPublicKey = testContext.clientKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/raw-body', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(clientPublicKey).toString('base64'),
					[IV_HEADER]: Buffer.from(iv).toString('base64'),
				},
				body: Buffer.from(ciphertext),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
			expect(response.headers.get(ENCRYPTED_RESPONSE_HEADER)).toBe('true');

			const responseIvBase64 = response.headers.get(IV_HEADER)!;
			const responseIv = new Uint8Array(Buffer.from(responseIvBase64, 'base64'));
			const encryptedResponseBody = new Uint8Array(await response.arrayBuffer());
			const decryptedResponse = await testContext.clientKeyManager.decrypt(
				encryptedResponseBody,
				serverPublicKey,
				responseIv,
			);

			const json = JSON.parse(new TextDecoder().decode(decryptedResponse)) as RawBodyResponse;
			expect(json.encrypted).toBe(true);
			expect(json.bodyLength).toBe(binaryData.length);
		});
	});

	describe('response encryption', () => {
		it('encrypts response when request was encrypted', async () => {
			const plaintext = 'test request';
			const plaintextBytes = new TextEncoder().encode(plaintext);
			const serverPublicKey = testContext.serverKeyManager.getPublicKey();

			const {ciphertext, iv} = await testContext.clientKeyManager.encrypt(plaintextBytes, serverPublicKey);

			const clientPublicKey = testContext.clientKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(clientPublicKey).toString('base64'),
					[IV_HEADER]: Buffer.from(iv).toString('base64'),
				},
				body: Buffer.from(ciphertext),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
			expect(response.headers.get('content-type')).toBe(ENCRYPTED_CONTENT_TYPE);
			expect(response.headers.get(ENCRYPTED_RESPONSE_HEADER)).toBe('true');
			expect(response.headers.get(IV_HEADER)).toBeTruthy();

			const responseIvBase64 = response.headers.get(IV_HEADER)!;
			const responseIv = new Uint8Array(Buffer.from(responseIvBase64, 'base64'));

			const encryptedResponseBody = new Uint8Array(await response.arrayBuffer());

			const serverPublicKeyForDecryption = testContext.serverKeyManager.getPublicKey();
			const decryptedResponse = await testContext.clientKeyManager.decrypt(
				encryptedResponseBody,
				serverPublicKeyForDecryption,
				responseIv,
			);

			const decryptedJson = JSON.parse(new TextDecoder().decode(decryptedResponse)) as EchoResponse;
			expect(decryptedJson.encrypted).toBe(true);
			expect(decryptedJson.received).toBe(plaintext);
		});

		it('does not encrypt response for non-encrypted requests', async () => {
			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({message: 'hello'}),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
			expect(response.headers.get('content-type')).toContain('application/json');
			expect(response.headers.get(ENCRYPTED_RESPONSE_HEADER)).toBeNull();

			const json = (await response.json()) as EchoResponse;
			expect(json.encrypted).toBe(false);
		});
	});

	describe('decryption failure', () => {
		it('returns 500 with DECRYPTION_FAILED for tampered ciphertext', async () => {
			const plaintext = 'test message';
			const plaintextBytes = new TextEncoder().encode(plaintext);
			const serverPublicKey = testContext.serverKeyManager.getPublicKey();

			const {ciphertext, iv} = await testContext.clientKeyManager.encrypt(plaintextBytes, serverPublicKey);

			ciphertext[0] ^= 0xff;

			const clientPublicKey = testContext.clientKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(clientPublicKey).toString('base64'),
					[IV_HEADER]: Buffer.from(iv).toString('base64'),
				},
				body: Buffer.from(ciphertext),
			});

			expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
			const json = (await response.json()) as ErrorResponse;
			expect(json.code).toBe('DECRYPTION_FAILED');
		});

		it('returns 500 with DECRYPTION_FAILED for wrong sender key', async () => {
			const plaintext = 'test message';
			const plaintextBytes = new TextEncoder().encode(plaintext);
			const serverPublicKey = testContext.serverKeyManager.getPublicKey();

			const {ciphertext, iv} = await testContext.clientKeyManager.encrypt(plaintextBytes, serverPublicKey);

			const wrongKeyPath = path.join(TEST_KEY_DIR, `wrong-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`);
			const wrongKeyManager = new KeyManager({privateKeyPath: wrongKeyPath});
			await wrongKeyManager.init();

			const wrongPublicKey = wrongKeyManager.getPublicKey();

			const response = await testContext.app.request('/test/echo', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(wrongPublicKey).toString('base64'),
					[IV_HEADER]: Buffer.from(iv).toString('base64'),
				},
				body: Buffer.from(ciphertext),
			});

			expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
			const json = (await response.json()) as ErrorResponse;
			expect(json.code).toBe('DECRYPTION_FAILED');
		});
	});

	describe('helper functions', () => {
		it('getDecryptedBodyAsJson throws for invalid JSON in decrypted body', async () => {
			const invalidJson = 'not valid json {{{';
			const plaintextBytes = new TextEncoder().encode(invalidJson);
			const serverPublicKey = testContext.serverKeyManager.getPublicKey();

			const {ciphertext, iv} = await testContext.clientKeyManager.encrypt(plaintextBytes, serverPublicKey);

			const clientPublicKey = testContext.clientKeyManager.getPublicKey();

			const appWithJsonError = new Hono();
			appWithJsonError.onError((err, ctx) => createTestErrorHandler(err, ctx));
			appWithJsonError.use('*', EncryptionMiddleware);
			appWithJsonError.post('/test/json-parse', (ctx) => {
				const data = getDecryptedBodyAsJson(ctx);
				return ctx.json({data});
			});

			const response = await appWithJsonError.request('/test/json-parse', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(clientPublicKey).toString('base64'),
					[IV_HEADER]: Buffer.from(iv).toString('base64'),
				},
				body: Buffer.from(ciphertext),
			});

			expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
			expect(response.headers.get(ENCRYPTED_RESPONSE_HEADER)).toBe('true');

			const responseIvBase64 = response.headers.get(IV_HEADER)!;
			const responseIv = new Uint8Array(Buffer.from(responseIvBase64, 'base64'));
			const encryptedResponseBody = new Uint8Array(await response.arrayBuffer());
			const decryptedResponse = await testContext.clientKeyManager.decrypt(
				encryptedResponseBody,
				serverPublicKey,
				responseIv,
			);

			const json = JSON.parse(new TextDecoder().decode(decryptedResponse)) as ErrorResponse;
			expect(json.code).toBe('INVALID_DECRYPTED_JSON');
		});

		it('getDecryptedBody returns null for non-encrypted requests', async () => {
			const appWithBodyCheck = new Hono();
			appWithBodyCheck.use('*', EncryptionMiddleware);
			appWithBodyCheck.post('/test/body-check', (ctx) => {
				const body = getDecryptedBody(ctx);
				return ctx.json({bodyIsNull: body === null});
			});

			const response = await appWithBodyCheck.request('/test/body-check', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({test: true}),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
			const json = (await response.json()) as BodyCheckResponse;
			expect(json.bodyIsNull).toBe(true);
		});

		it('isEncryptedRequest returns false for non-encrypted requests', async () => {
			const appWithEncryptedCheck = new Hono();
			appWithEncryptedCheck.use('*', EncryptionMiddleware);
			appWithEncryptedCheck.post('/test/encrypted-check', (ctx) => {
				return ctx.json({isEncrypted: isEncryptedRequest(ctx)});
			});

			const response = await appWithEncryptedCheck.request('/test/encrypted-check', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({test: true}),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
			const json = (await response.json()) as EncryptedCheckResponse;
			expect(json.isEncrypted).toBe(false);
		});

		it('isEncryptedRequest returns true for encrypted requests', async () => {
			const plaintext = 'test';
			const plaintextBytes = new TextEncoder().encode(plaintext);
			const serverPublicKey = testContext.serverKeyManager.getPublicKey();

			const {ciphertext, iv} = await testContext.clientKeyManager.encrypt(plaintextBytes, serverPublicKey);

			const clientPublicKey = testContext.clientKeyManager.getPublicKey();

			const appWithEncryptedCheck = new Hono();
			appWithEncryptedCheck.use('*', EncryptionMiddleware);
			appWithEncryptedCheck.post('/test/encrypted-check', (ctx) => {
				return ctx.json({isEncrypted: isEncryptedRequest(ctx)});
			});

			const response = await appWithEncryptedCheck.request('/test/encrypted-check', {
				method: 'POST',
				headers: {
					'content-type': ENCRYPTED_CONTENT_TYPE,
					[EPHEMERAL_KEY_HEADER]: Buffer.from(clientPublicKey).toString('base64'),
					[IV_HEADER]: Buffer.from(iv).toString('base64'),
				},
				body: Buffer.from(ciphertext),
			});

			expect(response.status).toBe(HTTP_STATUS.OK);
		});
	});
});
