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
import {KeyManager, KeyManagerError} from '@fluxer/api/src/federation/KeyManager';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

const TEST_KEY_DIR = '/tmp/fluxer-test-keys';

describe('KeyManager', () => {
	let testKeyPath: string;

	beforeEach(async () => {
		testKeyPath = path.join(TEST_KEY_DIR, `test-key-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`);
		await fs.mkdir(TEST_KEY_DIR, {recursive: true});
	});

	afterEach(async () => {
		try {
			await fs.rm(TEST_KEY_DIR, {recursive: true, force: true});
		} catch {}
	});

	describe('key generation', () => {
		it('generates new key pair on init when no file exists', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager.init();

			const publicKey = keyManager.getPublicKey();
			expect(publicKey).toBeInstanceOf(Uint8Array);
			expect(publicKey.length).toBe(32);
		});

		it('generates base64 public key', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager.init();

			const publicKeyBase64 = keyManager.getPublicKeyBase64();
			expect(typeof publicKeyBase64).toBe('string');
			expect(publicKeyBase64.length).toBeGreaterThan(0);

			const decoded = Buffer.from(publicKeyBase64, 'base64');
			expect(decoded.length).toBe(32);
		});

		it('generates unique key pairs', async () => {
			const keyManager1 = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager1.init();

			const testKeyPath2 = path.join(TEST_KEY_DIR, 'test-key-2.pem');
			const keyManager2 = new KeyManager({privateKeyPath: testKeyPath2});
			await keyManager2.init();

			const publicKey1 = keyManager1.getPublicKeyBase64();
			const publicKey2 = keyManager2.getPublicKeyBase64();
			expect(publicKey1).not.toBe(publicKey2);
		});
	});

	describe('key persistence', () => {
		it('saves key to file on init', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager.init();

			const fileExists = await fs
				.access(testKeyPath)
				.then(() => true)
				.catch(() => false);
			expect(fileExists).toBe(true);
		});

		it('loads existing key from file', async () => {
			const keyManager1 = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager1.init();
			const publicKey1 = keyManager1.getPublicKeyBase64();

			const keyManager2 = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager2.init();
			const publicKey2 = keyManager2.getPublicKeyBase64();

			expect(publicKey1).toBe(publicKey2);
		});

		it('creates directory if it does not exist', async () => {
			const nestedPath = path.join(TEST_KEY_DIR, 'nested', 'dir', 'key.pem');
			const keyManager = new KeyManager({privateKeyPath: nestedPath});
			await keyManager.init();

			const fileExists = await fs
				.access(nestedPath)
				.then(() => true)
				.catch(() => false);
			expect(fileExists).toBe(true);
		});
	});

	describe('encryption roundtrip', () => {
		it('encrypts and decrypts data successfully', async () => {
			const sender = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'sender.pem')});
			const recipient = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'recipient.pem')});
			await sender.init();
			await recipient.init();

			const plaintext = new TextEncoder().encode('Hello, encrypted world!');
			const recipientPublicKey = recipient.getPublicKey();

			const {ciphertext, iv} = await sender.encrypt(plaintext, recipientPublicKey);

			const senderPublicKey = sender.getPublicKey();
			const decrypted = await recipient.decrypt(ciphertext, senderPublicKey, iv);

			expect(new TextDecoder().decode(decrypted)).toBe('Hello, encrypted world!');
		});

		it('handles empty plaintext', async () => {
			const sender = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'sender.pem')});
			const recipient = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'recipient.pem')});
			await sender.init();
			await recipient.init();

			const plaintext = new Uint8Array(0);
			const recipientPublicKey = recipient.getPublicKey();

			const {ciphertext, iv} = await sender.encrypt(plaintext, recipientPublicKey);
			const senderPublicKey = sender.getPublicKey();
			const decrypted = await recipient.decrypt(ciphertext, senderPublicKey, iv);

			expect(decrypted.length).toBe(0);
		});

		it('handles large plaintext', async () => {
			const sender = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'sender.pem')});
			const recipient = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'recipient.pem')});
			await sender.init();
			await recipient.init();

			const plaintext = new Uint8Array(1024 * 100);
			for (let i = 0; i < plaintext.length; i++) {
				plaintext[i] = i % 256;
			}

			const recipientPublicKey = recipient.getPublicKey();
			const {ciphertext, iv} = await sender.encrypt(plaintext, recipientPublicKey);
			const senderPublicKey = sender.getPublicKey();
			const decrypted = await recipient.decrypt(ciphertext, senderPublicKey, iv);

			expect(decrypted.length).toBe(plaintext.length);
			expect(decrypted).toEqual(plaintext);
		});

		it('handles binary data', async () => {
			const sender = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'sender.pem')});
			const recipient = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'recipient.pem')});
			await sender.init();
			await recipient.init();

			const plaintext = new Uint8Array([0x00, 0xff, 0x7f, 0x80, 0x01, 0xfe]);
			const recipientPublicKey = recipient.getPublicKey();

			const {ciphertext, iv} = await sender.encrypt(plaintext, recipientPublicKey);
			const senderPublicKey = sender.getPublicKey();
			const decrypted = await recipient.decrypt(ciphertext, senderPublicKey, iv);

			expect(decrypted).toEqual(plaintext);
		});

		it('uses different IV for each encryption', async () => {
			const sender = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'sender.pem')});
			const recipient = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'recipient.pem')});
			await sender.init();
			await recipient.init();

			const plaintext = new TextEncoder().encode('Same message');
			const recipientPublicKey = recipient.getPublicKey();

			const result1 = await sender.encrypt(plaintext, recipientPublicKey);
			const result2 = await sender.encrypt(plaintext, recipientPublicKey);

			expect(Buffer.from(result1.iv).toString('hex')).not.toBe(Buffer.from(result2.iv).toString('hex'));
		});
	});

	describe('error cases', () => {
		it('throws when getting public key before init', () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			expect(() => keyManager.getPublicKey()).toThrow(KeyManagerError);
		});

		it('throws when decrypting before init', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await expect(keyManager.decrypt(new Uint8Array(32), new Uint8Array(32), new Uint8Array(12))).rejects.toThrow(
				KeyManagerError,
			);
		});

		it('throws when encrypting before init', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await expect(keyManager.encrypt(new Uint8Array(10), new Uint8Array(32))).rejects.toThrow(KeyManagerError);
		});

		it('throws with invalid ephemeral key size', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager.init();

			await expect(keyManager.decrypt(new Uint8Array(32), new Uint8Array(16), new Uint8Array(12))).rejects.toThrow(
				/Invalid ephemeral public key size/,
			);
		});

		it('throws with invalid IV size', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager.init();

			await expect(keyManager.decrypt(new Uint8Array(32), new Uint8Array(32), new Uint8Array(8))).rejects.toThrow(
				/Invalid IV size/,
			);
		});

		it('throws with invalid recipient key size', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager.init();

			await expect(keyManager.encrypt(new Uint8Array(10), new Uint8Array(16))).rejects.toThrow(
				/Invalid recipient public key size/,
			);
		});

		it('throws on ciphertext too short', async () => {
			const keyManager = new KeyManager({privateKeyPath: testKeyPath});
			await keyManager.init();

			await expect(keyManager.decrypt(new Uint8Array(8), new Uint8Array(32), new Uint8Array(12))).rejects.toThrow(
				/Ciphertext too short/,
			);
		});

		it('throws on auth tag mismatch (tampered ciphertext)', async () => {
			const sender = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'sender.pem')});
			const recipient = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'recipient.pem')});
			await sender.init();
			await recipient.init();

			const plaintext = new TextEncoder().encode('Secret message');
			const recipientPublicKey = recipient.getPublicKey();

			const {ciphertext, iv} = await sender.encrypt(plaintext, recipientPublicKey);

			ciphertext[0] ^= 0xff;

			const senderPublicKey = sender.getPublicKey();
			await expect(recipient.decrypt(ciphertext, senderPublicKey, iv)).rejects.toThrow(/Decryption failed/);
		});
	});

	describe('shared secret derivation', () => {
		it('same shared secret from both directions', async () => {
			const alice = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'alice.pem')});
			const bob = new KeyManager({privateKeyPath: path.join(TEST_KEY_DIR, 'bob.pem')});
			await alice.init();
			await bob.init();

			const message = new TextEncoder().encode('Test message for both directions');

			const alicePublicKey = alice.getPublicKey();
			const bobPublicKey = bob.getPublicKey();

			const {ciphertext: fromAlice, iv: ivFromAlice} = await alice.encrypt(message, bobPublicKey);
			const decryptedByBob = await bob.decrypt(fromAlice, alicePublicKey, ivFromAlice);
			expect(new TextDecoder().decode(decryptedByBob)).toBe('Test message for both directions');

			const {ciphertext: fromBob, iv: ivFromBob} = await bob.encrypt(message, alicePublicKey);
			const decryptedByAlice = await alice.decrypt(fromBob, bobPublicKey, ivFromBob);
			expect(new TextDecoder().decode(decryptedByAlice)).toBe('Test message for both directions');
		});
	});
});
