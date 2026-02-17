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

import {getKeyManager, KeyManagerError} from '@fluxer/api/src/federation/KeyManager';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {DecryptionFailedError} from '@fluxer/errors/src/domains/federation/DecryptionFailedError';
import {EmptyEncryptedBodyError} from '@fluxer/errors/src/domains/federation/EmptyEncryptedBodyError';
import {EncryptionFailedError} from '@fluxer/errors/src/domains/federation/EncryptionFailedError';
import {InvalidDecryptedJsonError} from '@fluxer/errors/src/domains/federation/InvalidDecryptedJsonError';
import {InvalidEphemeralKeyError} from '@fluxer/errors/src/domains/federation/InvalidEphemeralKeyError';
import {InvalidIvError} from '@fluxer/errors/src/domains/federation/InvalidIvError';
import {MissingEphemeralKeyError} from '@fluxer/errors/src/domains/federation/MissingEphemeralKeyError';
import {MissingIvError} from '@fluxer/errors/src/domains/federation/MissingIvError';
import {createMiddleware} from 'hono/factory';

const ENCRYPTED_CONTENT_TYPE = 'application/x-fluxer-encrypted';
const EPHEMERAL_KEY_HEADER = 'x-fluxer-ephemeral-key';
const IV_HEADER = 'x-fluxer-iv';
const ENCRYPTED_RESPONSE_HEADER = 'x-fluxer-encrypted-response';

export interface EncryptionContext {
	decryptedBody: Uint8Array | null;
	isEncrypted: boolean;
	ephemeralPublicKey: Uint8Array | null;
}

declare module 'hono' {
	interface ContextVariableMap {
		encryption: EncryptionContext;
	}
}

export const EncryptionMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const contentType = ctx.req.header('content-type');

	if (contentType !== ENCRYPTED_CONTENT_TYPE) {
		ctx.set('encryption', {
			decryptedBody: null,
			isEncrypted: false,
			ephemeralPublicKey: null,
		});
		return next();
	}

	const ephemeralKeyBase64 = ctx.req.header(EPHEMERAL_KEY_HEADER);
	const ivBase64 = ctx.req.header(IV_HEADER);

	if (!ephemeralKeyBase64) {
		throw new MissingEphemeralKeyError();
	}

	if (!ivBase64) {
		throw new MissingIvError();
	}

	let ephemeralPublicKey: Uint8Array;
	let iv: Uint8Array;

	try {
		ephemeralPublicKey = new Uint8Array(Buffer.from(ephemeralKeyBase64, 'base64'));
	} catch {
		throw new InvalidEphemeralKeyError();
	}

	try {
		iv = new Uint8Array(Buffer.from(ivBase64, 'base64'));
	} catch {
		throw new InvalidIvError();
	}

	const encryptedBody = await ctx.req.arrayBuffer();
	const ciphertext = new Uint8Array(encryptedBody);

	if (ciphertext.length === 0) {
		throw new EmptyEncryptedBodyError();
	}

	let decryptedBody: Uint8Array;

	try {
		const keyManager = getKeyManager();
		decryptedBody = await keyManager.decrypt(ciphertext, ephemeralPublicKey, iv);
	} catch (error) {
		if (error instanceof KeyManagerError) {
			throw new DecryptionFailedError();
		}
		throw error;
	}

	ctx.set('encryption', {
		decryptedBody,
		isEncrypted: true,
		ephemeralPublicKey,
	});

	await next();

	const encryptionContext = ctx.get('encryption');
	if (encryptionContext?.isEncrypted && encryptionContext.ephemeralPublicKey) {
		const responseBody = await ctx.res.arrayBuffer();

		if (responseBody.byteLength > 0) {
			try {
				const keyManager = getKeyManager();
				const {ciphertext: encryptedResponse, iv: responseIv} = await keyManager.encrypt(
					new Uint8Array(responseBody),
					encryptionContext.ephemeralPublicKey,
				);

				const newHeaders = new Headers(ctx.res.headers);
				newHeaders.set('content-type', ENCRYPTED_CONTENT_TYPE);
				newHeaders.set(IV_HEADER, Buffer.from(responseIv).toString('base64'));
				newHeaders.set(ENCRYPTED_RESPONSE_HEADER, 'true');

				ctx.res = new Response(encryptedResponse, {
					status: ctx.res.status,
					statusText: ctx.res.statusText,
					headers: newHeaders,
				});
			} catch (error) {
				if (error instanceof KeyManagerError) {
					throw new EncryptionFailedError();
				}
				throw error;
			}
		}
	}
});

export function getDecryptedBody(ctx: {get: (key: 'encryption') => EncryptionContext | undefined}): Uint8Array | null {
	const encryptionContext = ctx.get('encryption');
	return encryptionContext?.decryptedBody ?? null;
}

export function getDecryptedBodyAsJson<T>(ctx: {get: (key: 'encryption') => EncryptionContext | undefined}): T | null {
	const decryptedBody = getDecryptedBody(ctx);
	if (!decryptedBody) {
		return null;
	}

	try {
		const text = new TextDecoder().decode(decryptedBody);
		return JSON.parse(text) as T;
	} catch {
		throw new InvalidDecryptedJsonError();
	}
}

export function isEncryptedRequest(ctx: {get: (key: 'encryption') => EncryptionContext | undefined}): boolean {
	const encryptionContext = ctx.get('encryption');
	return encryptionContext?.isEncrypted ?? false;
}
