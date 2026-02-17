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

import {Logger} from '@app/lib/Logger';

const logger = new Logger('E2EEncryption');

const AES_GCM_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 128;

export interface X25519KeyPair {
	privateKey: CryptoKey;
	publicKey: CryptoKey;
	publicKeyBase64: string;
}

export interface EncryptedPayload {
	ciphertext: string;
	iv: string;
	ephemeralPublicKey: string;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer as ArrayBuffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binaryString = '';
	for (let i = 0; i < bytes.length; i++) {
		binaryString += String.fromCharCode(bytes[i]);
	}
	return btoa(binaryString);
}

function generateIV(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

export async function generateKeyPair(): Promise<X25519KeyPair> {
	const keyPair = (await crypto.subtle.generateKey({name: 'X25519'}, true, ['deriveBits'])) as CryptoKeyPair;

	const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
	const publicKeyBase64 = arrayBufferToBase64(rawPublicKey);

	logger.debug('Generated ephemeral X25519 key pair');

	return {
		privateKey: keyPair.privateKey,
		publicKey: keyPair.publicKey,
		publicKeyBase64,
	};
}

export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
	const keyData = base64ToArrayBuffer(publicKeyBase64);
	return await crypto.subtle.importKey('raw', keyData, {name: 'X25519'}, true, []);
}

export async function deriveSharedSecret(ourPrivateKey: CryptoKey, theirPublicKey: CryptoKey): Promise<CryptoKey> {
	const sharedBits = await crypto.subtle.deriveBits(
		{
			name: 'X25519',
			public: theirPublicKey,
		},
		ourPrivateKey,
		256,
	);

	const aesKey = await crypto.subtle.importKey(
		'raw',
		sharedBits,
		{name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH},
		false,
		['encrypt', 'decrypt'],
	);

	logger.debug('Derived shared secret via X25519 key exchange');

	return aesKey;
}

export async function encrypt(
	plaintext: string | Uint8Array,
	sharedSecret: CryptoKey,
): Promise<{ciphertext: string; iv: string}> {
	const iv = generateIV();
	const encoded = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;
	const data = new Uint8Array(encoded) as Uint8Array<ArrayBuffer>;

	const ciphertextBuffer = await crypto.subtle.encrypt(
		{
			name: AES_GCM_ALGORITHM,
			iv: iv as Uint8Array<ArrayBuffer>,
			tagLength: AUTH_TAG_LENGTH,
		},
		sharedSecret,
		data,
	);

	return {
		ciphertext: arrayBufferToBase64(ciphertextBuffer),
		iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
	};
}

export async function decrypt(
	ciphertextBase64: string,
	sharedSecret: CryptoKey,
	ivBase64: string,
): Promise<Uint8Array> {
	const ciphertext = base64ToArrayBuffer(ciphertextBase64);
	const iv = new Uint8Array(base64ToArrayBuffer(ivBase64)) as Uint8Array<ArrayBuffer>;

	const plaintextBuffer = await crypto.subtle.decrypt(
		{
			name: AES_GCM_ALGORITHM,
			iv,
			tagLength: AUTH_TAG_LENGTH,
		},
		sharedSecret,
		ciphertext,
	);

	return new Uint8Array(plaintextBuffer);
}

export function decryptToString(ciphertextBase64: string, sharedSecret: CryptoKey, ivBase64: string): Promise<string> {
	return decrypt(ciphertextBase64, sharedSecret, ivBase64).then((data) => new TextDecoder().decode(data));
}

export async function encryptForRecipient(
	plaintext: string | Uint8Array,
	recipientPublicKeyBase64: string,
): Promise<EncryptedPayload> {
	const ephemeralKeyPair = await generateKeyPair();
	const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64);
	const sharedSecret = await deriveSharedSecret(ephemeralKeyPair.privateKey, recipientPublicKey);
	const {ciphertext, iv} = await encrypt(plaintext, sharedSecret);

	logger.debug('Encrypted payload for recipient');

	return {
		ciphertext,
		iv,
		ephemeralPublicKey: ephemeralKeyPair.publicKeyBase64,
	};
}

export async function decryptFromSender(payload: EncryptedPayload, ourPrivateKey: CryptoKey): Promise<Uint8Array> {
	const senderPublicKey = await importPublicKey(payload.ephemeralPublicKey);
	const sharedSecret = await deriveSharedSecret(ourPrivateKey, senderPublicKey);
	return decrypt(payload.ciphertext, sharedSecret, payload.iv);
}

export function decryptFromSenderToString(payload: EncryptedPayload, ourPrivateKey: CryptoKey): Promise<string> {
	return decryptFromSender(payload, ourPrivateKey).then((data) => new TextDecoder().decode(data));
}

export function isWebCryptoAvailable(): boolean {
	return (
		typeof crypto !== 'undefined' &&
		typeof crypto.subtle !== 'undefined' &&
		typeof crypto.subtle.generateKey === 'function'
	);
}
