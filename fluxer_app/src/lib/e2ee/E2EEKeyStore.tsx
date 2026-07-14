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

import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

const DB_NAME = 'FluxerE2EE';
// One-way ratchet — see feedback_idb_version_bump.md in agent memory.
// v8 adds a by_channel index and a decrypted message snapshot to
// message_plaintexts. This lets DM/GDM search stay entirely on-device:
// plaintext queries and results never enter the server-side search index.
// v7 adds attachment_keys: standalone per-message persistence of the
// AES keys we pulled out of the v2 envelope. Without this the bubble
// can't decrypt previously-loaded attachments after a reload, since
// the in-memory attachmentKeyCache resets and re-decrypt fails (Olm
// ratchets are one-shot).
// v6 added message_plaintexts: per-message plaintext cache so the
// receiver can re-render encrypted history on refresh without
// re-running decrypt (Olm/Megolm both consume per-message material on
// decrypt — re-attempting fails). v5 had the Megolm stores; v4 the
// 1:1 Olm stores. Idempotent upgrades preserve data.
const DB_VERSION = 8;
const ACCOUNT_STORE = 'accounts';
const SESSION_STORE = 'sessions';
const META_STORE = 'meta';
const OUTBOUND_GROUP_SESSION_STORE = 'outbound_group_sessions';
const INBOUND_GROUP_SESSION_STORE = 'inbound_group_sessions';
const MESSAGE_PLAINTEXT_STORE = 'message_plaintexts';
const ATTACHMENT_KEYS_STORE = 'attachment_keys';
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

// Megolm outbound group session — one active per channel for the
// sender. Used for group DM encryption. Rotates on member removal
// (to lock out the removed device immediately) and periodically
// (per message-count or age threshold, enforced at use-time).
export interface PickledOutboundGroupSession {
	channel_id: string;
	session_id: string;
	pickle: string;
	created_at: number;
	message_count: number;
	// Hash of the sorted (user_id|device_id) list this session_key has
	// been distributed to. When the live recipient set diverges from this
	// hash (member device added/removed/replaced), the session is dropped
	// so the next send creates a fresh one + redistributes to all current
	// devices. Optional for backwards compat with pre-existing rows.
	recipient_set_hash?: string;
}

// Megolm inbound group session — one per (channel, sender device,
// session id). Receivers store one of these for each sender they
// receive an encrypted group message from, so they can ratchet
// forward and decrypt subsequent messages without further key
// exchange. Sender_identity_key is captured at receive time so we
// can detect identity rotation later.
export interface PickledInboundGroupSession {
	channel_id: string;
	sender_user_id: string;
	sender_device_id: string;
	session_id: string;
	pickle: string;
	sender_identity_key: string;
	created_at: number;
}

// Plaintext cache for already-decrypted incoming messages. Olm and
// Megolm both consume per-message material on decrypt, so re-running
// the cipher on a re-fetched ciphertext after a refresh fails.
// Caching the plaintext after the first successful decrypt lets the
// renderer paint the message bubble immediately on history fetch
// without re-decrypt.
//
// The verification_status + attachments fields piggyback on the
// cache so renderer-side metadata is preserved across refresh too.
//
// `attachments` mirrors the EnvelopeAttachmentEntry shape used by the
// receiver-side bubble — kept structural here to avoid importing the
// integration module into the storage layer.
export interface MessagePlaintextEntry {
	message_id: string;
	channel_id?: string;
	plaintext: string;
	/** Decrypted snapshot used by local E2EE search. Older v7 rows omit it. */
	message?: Message;
	attachments?: ReadonlyArray<{
		key: string;
		iv: string;
		mime: string;
		name: string;
		width?: number;
		height?: number;
	}>;
	verification_status?: 'verified' | 'changed' | 'unverified';
	created_at: number;
}

let dbInstance: IDBDatabase | null = null;

function attemptOpen(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error ?? new Error('Failed to open E2EE database'));
		request.onblocked = () => reject(new Error('E2EE database open blocked by another tab'));
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = (event) => {
			const openRequest = event.target as IDBOpenDBRequest;
			const db = openRequest.result;
			const upgradeTransaction = openRequest.transaction;
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
			if (!db.objectStoreNames.contains(OUTBOUND_GROUP_SESSION_STORE)) {
				// Only one active outbound session per channel; channel_id is
				// the natural primary key. New sessions overwrite the old one
				// when we rotate (member-removal, age, etc.).
				db.createObjectStore(OUTBOUND_GROUP_SESSION_STORE, {keyPath: 'channel_id'});
			}
			if (!db.objectStoreNames.contains(INBOUND_GROUP_SESSION_STORE)) {
				const store = db.createObjectStore(INBOUND_GROUP_SESSION_STORE, {
					keyPath: ['channel_id', 'sender_user_id', 'sender_device_id', 'session_id'],
				});
				// Lets us look up "all sessions in this channel" when rotating
				// or wiping a channel's group-session state.
				store.createIndex('by_channel', 'channel_id', {unique: false});
			}
			const messagePlaintextStore = db.objectStoreNames.contains(MESSAGE_PLAINTEXT_STORE)
				? upgradeTransaction?.objectStore(MESSAGE_PLAINTEXT_STORE)
				: db.createObjectStore(MESSAGE_PLAINTEXT_STORE, {keyPath: 'message_id'});
			if (messagePlaintextStore && !messagePlaintextStore.indexNames.contains('by_channel')) {
				messagePlaintextStore.createIndex('by_channel', 'channel_id', {unique: false});
			}
			if (!db.objectStoreNames.contains(ATTACHMENT_KEYS_STORE)) {
				db.createObjectStore(ATTACHMENT_KEYS_STORE, {keyPath: 'message_id'});
			}
		};
	});
}

function deleteDB(): Promise<void> {
	return new Promise((resolve) => {
		const request = indexedDB.deleteDatabase(DB_NAME);
		// Resolve on every terminal state — if we can't delete we still
		// want to fall through and surface the original open error to the
		// caller rather than hanging here.
		request.onsuccess = () => resolve();
		request.onerror = () => resolve();
		request.onblocked = () => resolve();
	});
}

// A stored database at a HIGHER version than this build expects is the one
// failure IndexedDB genuinely cannot recover from — it refuses to downgrade.
// Everything else (a second tab holding the connection, a quota trip, a
// transient backing-store error) is recoverable and must never cost the user
// their identity.
function isVersionError(err: unknown): boolean {
	return err instanceof DOMException && err.name === 'VersionError';
}

async function openDB(): Promise<IDBDatabase> {
	if (dbInstance) return dbInstance;
	try {
		dbInstance = await attemptOpen();
		return dbInstance;
	} catch (err) {
		// Deleting this database destroys the Olm identity, every Olm and
		// Megolm session, and the whole decrypted-message cache — and
		// doBootstrap reads the resulting empty store as "first run" and
		// silently mints a NEW device. So only wipe for the one error that
		// leaves no alternative: a stored version newer than this build.
		//
		// Anything else is rethrown, which puts E2EEStore into
		// registrationStatus='error' and retries on the next gateway READY.
		// Previously this catch was unqualified, so an `onblocked` reject
		// from merely opening a second tab silently destroyed the user's
		// history and identity.
		if (!isVersionError(err)) throw err;
		await deleteDB();
		dbInstance = await attemptOpen();
		return dbInstance;
	}
}

// The Olm identity, every session, and the decrypted-message cache all live in
// this IndexedDB. Without an explicit grant the origin is "best-effort" storage
// that the browser may evict under disk pressure — and an evicted store reads
// to doBootstrap() as "no account", costing the user a brand-new identity, all
// of their decryptable history, and a permanent slot in every peer's encrypt
// fan-out. The grant is sticky, so asking once is enough.
//
// Best-effort by contract: never throws, never blocks bootstrap. Note that
// Firefox surfaces a permission prompt here; Chromium auto-grants for
// installed apps and decides heuristically otherwise.
export async function requestPersistentStorage(): Promise<boolean> {
	try {
		if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
		if (await navigator.storage.persisted()) return true;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
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

// ── Megolm group sessions ───────────────────────────────────────────────
// Used by group DM E2EE. Outbound = sender's ratcheting session for one
// channel. Inbound = one per (channel, sender device, session_id) for
// every group session a recipient has been invited into.

export async function getOutboundGroupSession(channelId: string): Promise<PickledOutboundGroupSession | null> {
	const db = await openDB();
	const tx = db.transaction([OUTBOUND_GROUP_SESSION_STORE], 'readonly');
	const result = await reqToPromise(tx.objectStore(OUTBOUND_GROUP_SESSION_STORE).get(channelId));
	return (result as PickledOutboundGroupSession | undefined) ?? null;
}

export async function putOutboundGroupSession(session: PickledOutboundGroupSession): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([OUTBOUND_GROUP_SESSION_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(OUTBOUND_GROUP_SESSION_STORE).put(session));
}

export async function deleteOutboundGroupSession(channelId: string): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([OUTBOUND_GROUP_SESSION_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(OUTBOUND_GROUP_SESSION_STORE).delete(channelId));
}

export async function getInboundGroupSession(
	channelId: string,
	senderUserId: string,
	senderDeviceId: string,
	sessionId: string,
): Promise<PickledInboundGroupSession | null> {
	const db = await openDB();
	const tx = db.transaction([INBOUND_GROUP_SESSION_STORE], 'readonly');
	const result = await reqToPromise(
		tx.objectStore(INBOUND_GROUP_SESSION_STORE).get([channelId, senderUserId, senderDeviceId, sessionId]),
	);
	return (result as PickledInboundGroupSession | undefined) ?? null;
}

export async function putInboundGroupSession(session: PickledInboundGroupSession): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([INBOUND_GROUP_SESSION_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(INBOUND_GROUP_SESSION_STORE).put(session));
}

// Wipe every inbound and outbound session for a channel. Used when E2EE
// is turned off for the channel, or when the channel is left/deleted.
export async function deleteAllGroupSessionsForChannel(channelId: string): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([OUTBOUND_GROUP_SESSION_STORE, INBOUND_GROUP_SESSION_STORE], 'readwrite');
	tx.objectStore(OUTBOUND_GROUP_SESSION_STORE).delete(channelId);
	const idx = tx.objectStore(INBOUND_GROUP_SESSION_STORE).index('by_channel');
	const cursorReq = idx.openCursor(IDBKeyRange.only(channelId));
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
		cursorReq.onerror = () => reject(cursorReq.error ?? new Error('Failed to wipe channel group sessions'));
	});
}

// ── Message plaintext cache ─────────────────────────────────────────────
// After a successful decrypt, stash the plaintext keyed by message id so
// a history-fetch on refresh can re-render without re-running Olm/Megolm
// (both consume per-message material — second decrypt fails).

export async function getMessagePlaintext(messageId: string): Promise<MessagePlaintextEntry | null> {
	const db = await openDB();
	const tx = db.transaction([MESSAGE_PLAINTEXT_STORE], 'readonly');
	const result = await reqToPromise(tx.objectStore(MESSAGE_PLAINTEXT_STORE).get(messageId));
	return (result as MessagePlaintextEntry | undefined) ?? null;
}

export async function putMessagePlaintext(entry: MessagePlaintextEntry): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([MESSAGE_PLAINTEXT_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(MESSAGE_PLAINTEXT_STORE).put(entry));
}

export async function getSearchableMessagePlaintextsForChannel(
	channelId: string,
): Promise<Array<MessagePlaintextEntry>> {
	const db = await openDB();
	const tx = db.transaction([MESSAGE_PLAINTEXT_STORE], 'readonly');
	const store = tx.objectStore(MESSAGE_PLAINTEXT_STORE);
	if (!store.indexNames.contains('by_channel')) {
		return [];
	}
	const result = await reqToPromise(store.index('by_channel').getAll(IDBKeyRange.only(channelId)));
	return ((result as Array<MessagePlaintextEntry>) ?? []).filter((entry) => entry.message != null);
}

export async function deleteMessagePlaintexts(messageIds: ReadonlyArray<string>): Promise<void> {
	if (messageIds.length === 0) return;
	const db = await openDB();
	const tx = db.transaction([MESSAGE_PLAINTEXT_STORE], 'readwrite');
	const store = tx.objectStore(MESSAGE_PLAINTEXT_STORE);
	await Promise.all(messageIds.map((messageId) => reqToPromise(store.delete(messageId))));
}

export async function deleteAllMessagePlaintexts(): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([MESSAGE_PLAINTEXT_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(MESSAGE_PLAINTEXT_STORE).clear());
}

// ── Attachment key cache ────────────────────────────────────────────────
// Stores the per-attachment AES keys extracted from the v2 envelope so
// the EncryptedAttachmentBubble can decrypt previously-rendered images
// after a page refresh. In-memory attachmentKeyCache resets on reload;
// this is the durable backing.

export interface AttachmentKeysEntry {
	message_id: string;
	entries: ReadonlyArray<{
		id: string;
		key: string;
		iv: string;
		mime: string;
		name: string;
		width?: number;
		height?: number;
	}>;
	created_at: number;
}

export async function getAttachmentKeys(messageId: string): Promise<AttachmentKeysEntry | null> {
	const db = await openDB();
	const tx = db.transaction([ATTACHMENT_KEYS_STORE], 'readonly');
	const result = await reqToPromise(tx.objectStore(ATTACHMENT_KEYS_STORE).get(messageId));
	return (result as AttachmentKeysEntry | undefined) ?? null;
}

export async function putAttachmentKeys(entry: AttachmentKeysEntry): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([ATTACHMENT_KEYS_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(ATTACHMENT_KEYS_STORE).put(entry));
}

export async function deleteAllAttachmentKeys(): Promise<void> {
	const db = await openDB();
	const tx = db.transaction([ATTACHMENT_KEYS_STORE], 'readwrite');
	await reqToPromise(tx.objectStore(ATTACHMENT_KEYS_STORE).clear());
}
