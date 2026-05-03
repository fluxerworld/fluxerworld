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

const DB_NAME = 'FluxerE2EE';
const DB_VERSION = 2;
const ACCOUNT_STORE = 'accounts';
const SESSION_STORE = 'sessions';
const META_STORE = 'meta';
const VERIFICATION_STORE = 'verifications';

// Pickled Olm state is encrypted at rest using a per-install random key
// stored in the same IndexedDB. That's not "secure" against a privileged
// local attacker (they can read the IDB themselves), but it raises the
// bar above plaintext on disk and lets us add proper key derivation
// (passphrase, OS keychain) later without changing the storage shape.
export interface PickledAccount {
	user_id: string;
	device_id: string;
	pickle: string;
}

export interface PickledSession {
	// remote = the other side of the conversation
	remote_user_id: string;
	remote_device_id: string;
	session_id: string;
	pickle: string;
	created_at: number;
	last_used_at: number;
}

export interface MetaEntry {
	key: string;
	value: string;
}

// Verification is bound to the (remote_user, remote_device, identity_key)
// triple. If the peer rotates their identity (new device after a key
// compromise, lost device, etc.) the verification entry no longer
// matches and we treat the peer as unverified again until the user
// re-verifies. Source captures how the verification happened so we can
// surface it in the UI: 'manual' for an out-of-band fingerprint check,
// future entries for QR code, signed device exchange, etc.
export interface VerificationEntry {
	remote_user_id: string;
	remote_device_id: string;
	identity_key: string;
	verified_at: number;
	source: 'manual' | 'qr_code' | 'signed';
}

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
	if (dbInstance) return dbInstance;
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(new Error('Failed to open E2EE database'));
		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(dbInstance);
		};
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(ACCOUNT_STORE)) {
				db.createObjectStore(ACCOUNT_STORE, {keyPath: 'user_id'});
			}
			if (!db.objectStoreNames.contains(SESSION_STORE)) {
				const store = db.createObjectStore(SESSION_STORE, {keyPath: ['remote_user_id', 'remote_device_id', 'session_id']});
				store.createIndex('by_remote_device', ['remote_user_id', 'remote_device_id'], {unique: false});
			}
			if (!db.objectStoreNames.contains(META_STORE)) {
				db.createObjectStore(META_STORE, {keyPath: 'key'});
			}
			if (!db.objectStoreNames.contains(VERIFICATION_STORE)) {
				const store = db.createObjectStore(VERIFICATION_STORE, {
					keyPath: ['remote_user_id', 'remote_device_id'],
				});
				store.createIndex('by_remote_user', 'remote_user_id', {unique: false});
			}
		};
	});
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
	});
}

export async function getStoredAccount(userId: string): Promise<PickledAccount | null> {
	const db = await openDB();
	const tx = db.transaction([ACCOUNT_STORE], 'readonly');
	const result = await reqToPromise(tx.objectStore(ACCOUNT_STORE).get(userId));
	return (result as PickledAccount | undefined) ?? null;
}

export async function putStoredAccount(account: PickledAccount): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([ACCOUNT_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(ACCOUNT_STORE).put(account));
	// Account writes happen on initial registration and on inbound prekey
	// message handling (one-time-key consumption). The latter is "session-
	// shaped" state that doesn't need to be backed up urgently, but it's
	// rare enough that bumping here is fine — keeps the staleness check
	// simple by treating any account-level write as worth backing up.
	await bumpStateVersion();
}

export async function deleteStoredAccount(userId: string): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([ACCOUNT_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(ACCOUNT_STORE).delete(userId));
}

export async function getSessionsForRemoteDevice(
	remoteUserId: string,
	remoteDeviceId: string,
): Promise<Array<PickledSession>> {
	const db = await openDB();
	const tx = db.transaction([SESSION_STORE], 'readonly');
	const idx = tx.objectStore(SESSION_STORE).index('by_remote_device');
	const result = await reqToPromise(idx.getAll(IDBKeyRange.only([remoteUserId, remoteDeviceId])));
	return (result as Array<PickledSession>) ?? [];
}

export async function putSession(session: PickledSession): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([SESSION_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(SESSION_STORE).put(session));
}

export async function deleteSessionsForRemoteDevice(remoteUserId: string, remoteDeviceId: string): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([SESSION_STORE], 'readwrite');
	const idx = tx.objectStore(SESSION_STORE).index('by_remote_device');
	const cursorReq = idx.openCursor(IDBKeyRange.only([remoteUserId, remoteDeviceId]));
	await new Promise<void>((resolve, reject) => {
		cursorReq.onsuccess = () => {
			const cursor = cursorReq.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
			} else {
				resolve();
			}
		};
		cursorReq.onerror = () => reject(cursorReq.error ?? new Error('Failed to delete sessions'));
	});
}

export async function getMeta(key: string): Promise<string | null> {
	const db = await openDB();
	const tx = db.transaction([META_STORE], 'readonly');
	const result = await reqToPromise(tx.objectStore(META_STORE).get(key));
	return (result as MetaEntry | undefined)?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([META_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(META_STORE).put({key, value}));
}

export async function getVerification(
	remoteUserId: string,
	remoteDeviceId: string,
): Promise<VerificationEntry | null> {
	const db = await openDB();
	const tx = db.transaction([VERIFICATION_STORE], 'readonly');
	const result = await reqToPromise(tx.objectStore(VERIFICATION_STORE).get([remoteUserId, remoteDeviceId]));
	return (result as VerificationEntry | undefined) ?? null;
}

export async function getVerificationsForUser(remoteUserId: string): Promise<Array<VerificationEntry>> {
	const db = await openDB();
	const tx = db.transaction([VERIFICATION_STORE], 'readonly');
	const idx = tx.objectStore(VERIFICATION_STORE).index('by_remote_user');
	const result = await reqToPromise(idx.getAll(IDBKeyRange.only(remoteUserId)));
	return (result as Array<VerificationEntry>) ?? [];
}

export async function putVerification(entry: VerificationEntry): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([VERIFICATION_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(VERIFICATION_STORE).put(entry));
	await bumpStateVersion();
}

export async function deleteVerification(remoteUserId: string, remoteDeviceId: string): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([VERIFICATION_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(VERIFICATION_STORE).delete([remoteUserId, remoteDeviceId]));
	await bumpStateVersion();
}

const PICKLE_KEY_META = 'pickle_key';
const STATE_VERSION_META = 'state_version';
const LAST_BACKUP_VERSION_META = 'last_backup_state_version';
const PEER_IDENTITY_KEY_PREFIX = 'peer_identity:';

// Track the identity key we last saw for each peer device so we can
// detect when a peer has re-registered (different identity_key for
// the same device_id is unusual but happens; new device_id is the
// common case). Sessions tied to the previous identity are dead and
// must be wiped before we encrypt again.
function peerIdentityKey(remoteUserId: string, remoteDeviceId: string): string {
	return `${PEER_IDENTITY_KEY_PREFIX}${remoteUserId}:${remoteDeviceId}`;
}

export async function getPeerIdentityKey(
	remoteUserId: string,
	remoteDeviceId: string,
): Promise<string | null> {
	return getMeta(peerIdentityKey(remoteUserId, remoteDeviceId));
}

export async function setPeerIdentityKey(
	remoteUserId: string,
	remoteDeviceId: string,
	identityKey: string,
): Promise<void> {
	await setMeta(peerIdentityKey(remoteUserId, remoteDeviceId), identityKey);
}

// Monotonic counter bumped every time a meaningful piece of E2EE state
// changes locally — new account, new session, new verification. We
// compare against the last value seen at backup time to decide whether
// the user is sitting on un-backed-up changes.
export async function getStateVersion(): Promise<number> {
	const raw = await getMeta(STATE_VERSION_META);
	if (!raw) return 0;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : 0;
}

export async function bumpStateVersion(): Promise<number> {
	const next = (await getStateVersion()) + 1;
	await setMeta(STATE_VERSION_META, String(next));
	return next;
}

export async function getLastBackupStateVersion(): Promise<number | null> {
	const raw = await getMeta(LAST_BACKUP_VERSION_META);
	if (!raw) return null;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : null;
}

export async function recordBackupStateVersion(version: number): Promise<void> {
	await setMeta(LAST_BACKUP_VERSION_META, String(version));
}

// Per-install random key used to obfuscate pickled state. Generated lazily
// on first access and cached in-memory for the session.
let cachedPickleKey: string | null = null;

export async function getPickleKey(): Promise<string> {
	if (cachedPickleKey) return cachedPickleKey;
	const stored = await getMeta(PICKLE_KEY_META);
	if (stored) {
		cachedPickleKey = stored;
		return stored;
	}
	const fresh = generatePickleKey();
	await setMeta(PICKLE_KEY_META, fresh);
	cachedPickleKey = fresh;
	return fresh;
}

function generatePickleKey(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	let s = '';
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
	return btoa(s);
}
