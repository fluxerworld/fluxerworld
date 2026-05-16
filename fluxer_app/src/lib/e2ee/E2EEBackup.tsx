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

import {Endpoints} from '@app/Endpoints';
import {
	getLastBackupStateVersion,
	getMeta,
	getStateVersion,
	getStoredAccount,
	type PickledAccount,
	type PickledSession,
	putSession,
	putStoredAccount,
	putVerification,
	recordBackupStateVersion,
	setMeta,
	type VerificationEntry,
} from '@app/lib/e2ee/E2EEKeyStore';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';

const logger = new Logger('E2EEBackup');

const BACKUP_VERSION = 1;
const ALGORITHM = 'AES-GCM';
const KDF = 'PBKDF2-SHA256';
const KDF_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AES_KEY_BITS = 256;

interface BackupPayloadV1 {
	v: 1;
	account: PickledAccount | null;
	sessions: Array<PickledSession>;
	verifications: Array<VerificationEntry>;
	pickle_key: string | null;
}

interface BackupBlob {
	version: number;
	algorithm: string;
	kdf: string;
	salt: string;
	iterations: number;
	iv: string;
	ciphertext: string;
}

interface BackupServerResponse extends BackupBlob {
	created_at: string;
	updated_at: string;
}

function encodeBytes(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin);
}

function decodeBytes(b64: string): Uint8Array {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
	const baseKey = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(passphrase),
		'PBKDF2',
		false,
		['deriveKey'],
	);
	return crypto.subtle.deriveKey(
		{name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256'},
		baseKey,
		{name: 'AES-GCM', length: AES_KEY_BITS},
		false,
		['encrypt', 'decrypt'],
	);
}

async function buildPayload(userId: string): Promise<BackupPayloadV1> {
	const account = await getStoredAccount(userId);
	const sessions = await collectAllSessions();
	const verifications = await collectAllVerifications();
	const pickleKey = await getMeta('pickle_key');
	return {
		v: 1,
		account,
		sessions,
		verifications,
		pickle_key: pickleKey,
	};
}

// Pull every session/verification from IDB through the established
// helpers. We don't have store-wide list APIs (everything is keyed) so
// we read directly via cursor for the dump.
async function collectAllSessions(): Promise<Array<PickledSession>> {
	return openCursorRead<PickledSession>('sessions');
}

async function collectAllVerifications(): Promise<Array<VerificationEntry>> {
	return openCursorRead<VerificationEntry>('verifications');
}

function openCursorRead<T>(storeName: string): Promise<Array<T>> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open('FluxerE2EE', 4);
		req.onerror = () => reject(req.error ?? new Error('Failed to open E2EE DB'));
		req.onsuccess = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(storeName)) {
				resolve([]);
				return;
			}
			const tx = db.transaction([storeName], 'readonly');
			const store = tx.objectStore(storeName);
			const out: Array<T> = [];
			const cursorReq = store.openCursor();
			cursorReq.onsuccess = () => {
				const cursor = cursorReq.result;
				if (cursor) {
					out.push(cursor.value as T);
					cursor.continue();
				} else {
					resolve(out);
				}
			};
			cursorReq.onerror = () => reject(cursorReq.error ?? new Error('cursor failed'));
		};
	});
}

export async function buildAndUploadBackup(userId: string, passphrase: string): Promise<void> {
	if (passphrase.length < 8) {
		throw new Error('Passphrase must be at least 8 characters.');
	}
	const payload = await buildPayload(userId);
	const plaintext = new TextEncoder().encode(JSON.stringify(payload));

	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
	const ciphertextBuf = await crypto.subtle.encrypt(
		{name: 'AES-GCM', iv: iv as BufferSource},
		key,
		plaintext as BufferSource,
	);

	const body: BackupBlob = {
		version: BACKUP_VERSION,
		algorithm: ALGORITHM,
		kdf: KDF,
		salt: encodeBytes(salt),
		iterations: KDF_ITERATIONS,
		iv: encodeBytes(iv),
		ciphertext: encodeBytes(new Uint8Array(ciphertextBuf)),
	};

	await http.put(Endpoints.USER_E2EE_BACKUP, body);
	const stateVersion = await getStateVersion();
	await recordBackupStateVersion(stateVersion);
	logger.info('E2EE backup uploaded', {userId, ciphertextBytes: ciphertextBuf.byteLength, stateVersion});
}

// "Backup is stale" predicate. True when local state has advanced since
// the last successful upload, or when there's a backup on the server but
// we've never matched it locally (likely because we just restored).
export async function isBackupStale(): Promise<boolean> {
	const lastBackedUp = await getLastBackupStateVersion();
	if (lastBackedUp === null) return true;
	const current = await getStateVersion();
	return current > lastBackedUp;
}

export async function fetchBackupMetadata(): Promise<BackupServerResponse | null> {
	try {
		const resp = await http.get<BackupServerResponse>({url: Endpoints.USER_E2EE_BACKUP});
		return resp.body;
	} catch (err) {
		// 404 is the common case (no backup uploaded yet) — treat as null
		// so callers don't have to special-case the error type.
		logger.debug('E2EE backup fetch failed (likely 404)', {err});
		return null;
	}
}

export async function downloadAndRestoreBackup(passphrase: string): Promise<{
	sessionsRestored: number;
	verificationsRestored: number;
}> {
	const blob = await fetchBackupMetadata();
	if (!blob) throw new Error('No backup found on the server.');

	const salt = decodeBytes(blob.salt);
	const iv = decodeBytes(blob.iv);
	const ciphertext = decodeBytes(blob.ciphertext);
	const key = await deriveKey(passphrase, salt, blob.iterations);

	let plaintextBuf: ArrayBuffer;
	try {
		plaintextBuf = await crypto.subtle.decrypt(
			{name: 'AES-GCM', iv: iv as BufferSource},
			key,
			ciphertext as BufferSource,
		);
	} catch {
		throw new Error('Wrong passphrase, or the backup is corrupted.');
	}

	const decoded = new TextDecoder().decode(plaintextBuf);
	const payload = JSON.parse(decoded) as BackupPayloadV1;
	if (payload.v !== 1) throw new Error(`Unsupported backup version ${payload.v}`);

	if (payload.pickle_key) {
		await setMeta('pickle_key', payload.pickle_key);
	}
	if (payload.account) {
		await putStoredAccount(payload.account);
	}
	// If the backup had no account we leave any existing local account
	// alone — the user might have already registered post-backup, and we
	// shouldn't silently wipe live key material.
	let sessionsRestored = 0;
	for (const session of payload.sessions) {
		await putSession(session);
		sessionsRestored++;
	}
	let verificationsRestored = 0;
	for (const verification of payload.verifications) {
		await putVerification(verification);
		verificationsRestored++;
	}

	// The restore writes bumped the local state version; reset
	// last-backup-version to current so the staleness banner doesn't
	// immediately fire ("you just restored, that means your local state
	// matches the server backup").
	const stateVersion = await getStateVersion();
	await recordBackupStateVersion(stateVersion);

	logger.info('E2EE backup restored', {sessionsRestored, verificationsRestored, stateVersion});
	return {sessionsRestored, verificationsRestored};
}

export async function deleteBackup(): Promise<void> {
	await http.delete({url: Endpoints.USER_E2EE_BACKUP});
}
