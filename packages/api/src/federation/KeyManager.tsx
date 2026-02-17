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

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const KEY_SIZE = 32;
const NONCE_SIZE = 12;
const TAG_SIZE = 16;

interface KeyPair {
	publicKey: Uint8Array;
	privateKey: Uint8Array;
}

interface EncryptResult {
	ciphertext: Uint8Array;
	iv: Uint8Array;
}

export interface IKeyManager {
	init(): Promise<void>;
	getPublicKey(): Uint8Array;
	getPublicKeyBase64(): string;
	decrypt(ciphertext: Uint8Array, ephemeralPublicKey: Uint8Array, iv: Uint8Array): Promise<Uint8Array>;
	encrypt(plaintext: Uint8Array, recipientPublicKey: Uint8Array): Promise<EncryptResult>;
}

export interface KeyManagerConfig {
	privateKeyPath: string;
}

export class KeyManager implements IKeyManager {
	private keypair: KeyPair | null = null;
	private readonly config: KeyManagerConfig;

	constructor(config: KeyManagerConfig) {
		this.config = config;
	}

	async init(): Promise<void> {
		if (this.keypair !== null) {
			return;
		}

		if (this.config.privateKeyPath) {
			const exists = await this.fileExists(this.config.privateKeyPath);
			if (exists) {
				this.keypair = await this.loadKeyFromFile(this.config.privateKeyPath);
				return;
			}
		}

		this.keypair = this.generateKeyPair();

		if (this.config.privateKeyPath) {
			await this.saveKeyToFile(this.config.privateKeyPath, this.keypair);
		}
	}

	getPublicKey(): Uint8Array {
		const keypair = this.getKeypairOrThrow();
		return keypair.publicKey;
	}

	getPublicKeyBase64(): string {
		const keypair = this.getKeypairOrThrow();
		return Buffer.from(keypair.publicKey).toString('base64');
	}

	async decrypt(ciphertext: Uint8Array, ephemeralPublicKey: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
		const keypair = this.getKeypairOrThrow();

		if (ephemeralPublicKey.length !== KEY_SIZE) {
			throw new KeyManagerError(
				`Invalid ephemeral public key size: expected ${KEY_SIZE}, got ${ephemeralPublicKey.length}`,
			);
		}

		if (iv.length !== NONCE_SIZE) {
			throw new KeyManagerError(`Invalid IV size: expected ${NONCE_SIZE}, got ${iv.length}`);
		}

		if (ciphertext.length < TAG_SIZE) {
			throw new KeyManagerError(`Ciphertext too short: expected at least ${TAG_SIZE} bytes for auth tag`);
		}

		const sharedSecret = this.deriveSharedSecret(ephemeralPublicKey, keypair);

		const authTagStart = ciphertext.length - TAG_SIZE;
		const encryptedData = ciphertext.slice(0, authTagStart);
		const authTag = ciphertext.slice(authTagStart);

		try {
			const decipher = crypto.createDecipheriv('aes-256-gcm', sharedSecret, iv);
			decipher.setAuthTag(authTag);

			const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

			return new Uint8Array(decrypted);
		} catch (error) {
			throw new KeyManagerError(
				`Decryption failed: ${error instanceof Error ? error.message : 'unknown error'}. This typically indicates authentication tag mismatch, tampered ciphertext, wrong key, or corrupted data.`,
			);
		}
	}

	async encrypt(plaintext: Uint8Array, recipientPublicKey: Uint8Array): Promise<EncryptResult> {
		const keypair = this.getKeypairOrThrow();

		if (recipientPublicKey.length !== KEY_SIZE) {
			throw new KeyManagerError(
				`Invalid recipient public key size: expected ${KEY_SIZE}, got ${recipientPublicKey.length}`,
			);
		}

		const sharedSecret = this.deriveSharedSecret(recipientPublicKey, keypair);

		const iv = crypto.randomBytes(NONCE_SIZE);

		const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret, iv);

		const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
		const authTag = cipher.getAuthTag();

		const ciphertext = new Uint8Array(encrypted.length + authTag.length);
		ciphertext.set(encrypted, 0);
		ciphertext.set(authTag, encrypted.length);

		return {
			ciphertext,
			iv: new Uint8Array(iv),
		};
	}

	private generateKeyPair(): KeyPair {
		const {publicKey, privateKey} = crypto.generateKeyPairSync('x25519');

		const publicKeyRaw = publicKey.export({type: 'spki', format: 'der'});
		const privateKeyRaw = privateKey.export({type: 'pkcs8', format: 'der'});

		const publicKeyBytes = this.extractRawX25519PublicKey(publicKeyRaw);
		const privateKeyBytes = this.extractRawX25519PrivateKey(privateKeyRaw);

		return {
			publicKey: publicKeyBytes,
			privateKey: privateKeyBytes,
		};
	}

	private extractRawX25519PublicKey(spkiKey: Buffer): Uint8Array {
		return new Uint8Array(spkiKey.slice(-KEY_SIZE));
	}

	private extractRawX25519PrivateKey(pkcs8Key: Buffer): Uint8Array {
		return new Uint8Array(pkcs8Key.slice(-KEY_SIZE));
	}

	private deriveSharedSecret(peerPublicKey: Uint8Array, keypair: KeyPair): Buffer {
		const privateKeyObject = crypto.createPrivateKey({
			key: this.createPkcs8FromRaw(keypair.privateKey),
			format: 'der',
			type: 'pkcs8',
		});

		const peerPublicKeyObject = crypto.createPublicKey({
			key: this.createSpkiFromRaw(peerPublicKey),
			format: 'der',
			type: 'spki',
		});

		return crypto.diffieHellman({
			privateKey: privateKeyObject,
			publicKey: peerPublicKeyObject,
		});
	}

	private createPkcs8FromRaw(rawPrivateKey: Uint8Array): Buffer {
		const pkcs8Header = Buffer.from([
			0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
		]);
		return Buffer.concat([pkcs8Header, Buffer.from(rawPrivateKey)]);
	}

	private createSpkiFromRaw(rawPublicKey: Uint8Array): Buffer {
		const spkiHeader = Buffer.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00]);
		return Buffer.concat([spkiHeader, Buffer.from(rawPublicKey)]);
	}

	private async loadKeyFromFile(filePath: string): Promise<KeyPair> {
		try {
			const pemContent = await fs.readFile(filePath, 'utf-8');
			return this.parsePrivateKeyPem(pemContent);
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
				throw new KeyManagerError(`Key file not found: ${filePath}`);
			}
			if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
				throw new KeyManagerError(`Permission denied reading key file: ${filePath}`);
			}
			throw new KeyManagerError(
				`Failed to load key from file: ${error instanceof Error ? error.message : 'unknown error'}`,
			);
		}
	}

	private async saveKeyToFile(filePath: string, keypair: KeyPair): Promise<void> {
		const dir = path.dirname(filePath);
		try {
			await fs.mkdir(dir, {recursive: true});
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
				throw new KeyManagerError(`Failed to create directory for key file: ${error.message}`);
			}
		}

		const pemContent = this.createPrivateKeyPem(keypair);

		try {
			await fs.writeFile(filePath, pemContent, {mode: 0o600});
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
				throw new KeyManagerError(`Permission denied writing key file: ${filePath}`);
			}
			throw new KeyManagerError(
				`Failed to save key to file: ${error instanceof Error ? error.message : 'unknown error'}`,
			);
		}
	}

	private createPrivateKeyPem(keypair: KeyPair): string {
		const pkcs8Der = this.createPkcs8FromRaw(keypair.privateKey);
		const base64 = pkcs8Der.toString('base64');
		const lines: Array<string> = [];
		for (let i = 0; i < base64.length; i += 64) {
			lines.push(base64.slice(i, i + 64));
		}
		return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
	}

	private parsePrivateKeyPem(pemContent: string): KeyPair {
		const privateKeyObject = crypto.createPrivateKey({
			key: pemContent,
			format: 'pem',
		});

		const pkcs8Der = privateKeyObject.export({type: 'pkcs8', format: 'der'});
		const privateKeyBytes = this.extractRawX25519PrivateKey(pkcs8Der);

		const publicKeyObject = crypto.createPublicKey(privateKeyObject);
		const spkiDer = publicKeyObject.export({type: 'spki', format: 'der'});
		const publicKeyBytes = this.extractRawX25519PublicKey(spkiDer);

		return {
			publicKey: publicKeyBytes,
			privateKey: privateKeyBytes,
		};
	}

	private async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	private getKeypairOrThrow(): KeyPair {
		if (this.keypair === null) {
			throw new KeyManagerError('KeyManager has not been initialized. Call init() first.');
		}
		return this.keypair;
	}
}

export class KeyManagerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'KeyManagerError';
	}
}

let keyManagerInstance: KeyManager | null = null;

export function initializeKeyManager(config: KeyManagerConfig): KeyManager {
	if (keyManagerInstance !== null) {
		return keyManagerInstance;
	}
	keyManagerInstance = new KeyManager(config);
	return keyManagerInstance;
}

export function getKeyManager(): IKeyManager {
	if (keyManagerInstance === null) {
		throw new KeyManagerError('KeyManager has not been initialized. Call initializeKeyManager() first.');
	}
	return keyManagerInstance;
}

export function resetKeyManager(): void {
	keyManagerInstance = null;
}
