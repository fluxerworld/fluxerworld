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

import * as E2EEActionCreators from '@app/actions/E2EEActionCreators';
import {
	deleteAllGroupSessionsForChannel,
	deleteMessagePlaintexts,
	deleteOutboundGroupSession,
	deleteSessionsForRemoteDevice,
	getAttachmentKeys,
	getInboundGroupSession,
	getMessagePlaintext,
	getOutboundGroupSession,
	getPeerIdentityKey,
	getSessionsForRemoteDevice,
	putAttachmentKeys,
	putMessagePlaintext,
	putOutboundGroupSession,
	setPeerIdentityKey,
} from '@app/lib/e2ee/E2EEKeyStore';
import {e2eeManager} from '@app/lib/e2ee/E2EEManager';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import E2EEStore from '@app/stores/E2EEStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

const logger = new Logger('E2EEMessageIntegration');

// Wire shape for an Olm-fanned-out 1:1 DM message. Each recipient
// device gets its own ciphertext slot keyed by "user_id:device_id".
export interface EncryptedPayloadOlm {
	v: number;
	kind?: 'olm';
	sender_device_id: string;
	sender_identity_key: string;
	ciphertexts: Record<string, {type: number; body: string}>;
}

// Wire shape for a Megolm group DM message. Single ciphertext; the
// session_id identifies which Megolm session was used so the recipient
// can look up the matching inbound session in IDB (or fetch the
// session-key blob from the server first if missing).
export interface EncryptedPayloadMegolm {
	v: number;
	kind: 'megolm';
	sender_device_id: string;
	sender_identity_key: string;
	session_id: string;
	ciphertext: string;
}

export type EncryptedPayload = EncryptedPayloadOlm | EncryptedPayloadMegolm;

export interface EncryptedSendResult {
	content: string;
	flags_to_set: number;
	encrypted_payload: EncryptedPayload;
}

const SUPPORTED_CHANNEL_TYPES = new Set<number>([ChannelTypes.DM, ChannelTypes.GROUP_DM]);

// The plaintext sealed inside Olm has historically been the raw message
// content string. v2 wraps it in a JSON envelope so we can carry
// per-attachment AES keys (and any future per-message metadata) without
// changing the wire shape outside of Olm. v1 string and v2 envelope
// coexist on the wire — the receiver detects format on decrypt.
// One entry per encrypted attachment, in the same order as the
// outgoing multipart files[] / message.attachments[] arrays. The
// server assigns the durable attachment id post-upload, so we pair
// entries by *array index* on receive — the receiver inserts the
// server id when populating the cache.
export interface EnvelopeAttachmentEntry {
	key: string;         // base64 raw 32-byte AES-256 key
	iv: string;          // base64 raw 12-byte GCM nonce
	mime: string;        // original mime (the wire content_type is octet-stream)
	name: string;        // original filename
	width?: number;
	height?: number;
}

// Cache entry: same as the envelope entry but tagged with the wire
// attachment id so the renderer can look up by id without knowing index.
export type CachedAttachmentEntry = EnvelopeAttachmentEntry & {id: string};

interface EnvelopePayloadV2 {
	v: 2;
	text: string;
	attachments?: Array<EnvelopeAttachmentEntry>;
}

interface UnwrappedPlaintext {
	text: string;
	attachments: Array<EnvelopeAttachmentEntry>;
}

function wrapPlaintext(text: string, attachments?: ReadonlyArray<EnvelopeAttachmentEntry>): string {
	const envelope: EnvelopePayloadV2 = {v: 2, text};
	if (attachments && attachments.length > 0) envelope.attachments = [...attachments];
	return JSON.stringify(envelope);
}

// Reverse of wrapPlaintext, with a v1 fallback so messages from older
// senders (raw strings) keep decrypting cleanly. The detection is
// deliberately strict — only a JSON object with v === 2 and a string
// text counts as v2; anything else is treated as a v1 raw string. That
// way a user who legitimately types `{"v":1,"text":"hi"}` as their
// actual message body doesn't get mis-parsed.
function unwrapPlaintext(decrypted: string): UnwrappedPlaintext {
	if (decrypted.length === 0 || decrypted[0] !== '{') return {text: decrypted, attachments: []};
	try {
		const parsed = JSON.parse(decrypted) as Partial<EnvelopePayloadV2>;
		if (parsed && parsed.v === 2 && typeof parsed.text === 'string') {
			const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
			return {text: parsed.text, attachments};
		}
	} catch {
		// JSON parse failures fall through to v1.
	}
	return {text: decrypted, attachments: []};
}

// Per-message cache of the AES keys we extracted from the v2 envelope.
// Keyed by message id and then attachment id so the renderer can do a
// constant-time lookup. The cache is intentionally module-local — it
// doesn't survive a hard refresh, but neither does the in-memory
// MessageStore, so the contract holds: any message visible in the UI
// that had encrypted attachments will have its keys here.
const attachmentKeyCache = new Map<string, Map<string, CachedAttachmentEntry>>();

// Sender-side plaintext cache: when we send an encrypted message we
// don't include a ciphertext slot for our own device (we already
// have the plaintext locally), so the gateway echo of our own
// MESSAGE_CREATE can't decrypt and would otherwise display the
// "could not be decrypted" placeholder. Populating this map at send
// time lets the gateway handler skip the failure path for our own
// messages and render the original text instead.
const sentPlaintextCache = new Map<string, string>();

export function recordSentPlaintext(messageId: string, plaintext: string): void {
	sentPlaintextCache.set(messageId, plaintext);
}

export function getSentPlaintext(messageId: string): string | null {
	return sentPlaintextCache.get(messageId) ?? null;
}

export function cacheSearchableMessage(
	message: Message,
	plaintext: string,
	options?: {
		attachments?: ReadonlyArray<EnvelopeAttachmentEntry>;
		verificationStatus?: MessageVerificationStatus;
	},
): void {
	const {encrypted_payload: _encryptedPayload, ...messageWithoutPayload} = message;
	void putMessagePlaintext({
		message_id: message.id,
		channel_id: message.channel_id,
		plaintext,
		message: {...messageWithoutPayload, content: plaintext} as Message,
		attachments: options?.attachments?.length ? options.attachments : undefined,
		verification_status: options?.verificationStatus,
		created_at: Date.now(),
	}).catch((err: unknown) => {
		logger.warn('Failed to cache searchable message plaintext', {messageId: message.id, err});
	});
}

// Sender-side envelope-entries cache, keyed by nonce — same race story as
// sentPlaintextCache. Lets the gateway echo of our own message populate
// the per-attachment key cache even when decrypt returns null (no own
// ciphertext slot), so the receiver-side EncryptedAttachmentBubble path
// kicks in for the sender's own bubble too.
const sentEnvelopeEntriesByNonce = new Map<string, ReadonlyArray<EnvelopeAttachmentEntry>>();

export function recordSentEnvelopeEntries(
	nonce: string,
	entries: ReadonlyArray<EnvelopeAttachmentEntry>,
): void {
	sentEnvelopeEntriesByNonce.set(nonce, entries);
}

export function getSentEnvelopeEntries(nonce: string): ReadonlyArray<EnvelopeAttachmentEntry> | null {
	return sentEnvelopeEntriesByNonce.get(nonce) ?? null;
}

// Cache the verification status produced by tryDecryptForCurrentDevice so
// the message bubble can render a per-message lock/shield icon without
// re-running the verification lookup on every render. Populated from the
// gateway MESSAGE_CREATE handler and the history-fetch decrypt loop.
export type MessageVerificationStatus = 'verified' | 'changed' | 'unverified';
const messageVerificationCache = new Map<string, MessageVerificationStatus>();

export function recordMessageVerification(messageId: string, status: MessageVerificationStatus): void {
	messageVerificationCache.set(messageId, status);
}

export function getMessageVerification(messageId: string): MessageVerificationStatus | null {
	return messageVerificationCache.get(messageId) ?? null;
}

// Negative cache for permanently-undecryptable Megolm messages, keyed by
// `${channelId}|${sessionId}|${recipientDeviceId}`. A session lands here
// only when fetchAndImportGroupSessionFor returns 'no_blob' — no session-key
// blob targets this device (joined-after-send, or session lost/rotated-past).
// NOT populated for transient 'network_error's.
//
// In-memory only: a session restart clears it, giving a free retry — the
// right cadence, since a 'no_blob' session only becomes decryptable via a
// deliberate re-distribution (rare, covered by the explicit retry button).
// Cleared on logout via clearAllMessageCaches. Unbounded for now (short
// strings, bounded by distinct dead sessions seen this session); add an LRU
// cap as a fast-follow only if a pathological case appears.
const undecryptableSessions = new Set<string>();

function undecryptableKey(channelId: string, sessionId: string, deviceId: string): string {
	return `${channelId}|${sessionId}|${deviceId}`;
}

function markSessionUndecryptable(channelId: string, sessionId: string, deviceId: string): void {
	undecryptableSessions.add(undecryptableKey(channelId, sessionId, deviceId));
}

function isSessionUndecryptable(channelId: string, sessionId: string, deviceId: string): boolean {
	return undecryptableSessions.has(undecryptableKey(channelId, sessionId, deviceId));
}

// Clears a negative-cache entry so the next decrypt attempt retries the
// fetch. Wired to the placeholder "retry" button (step 5). Returns true if
// an entry was actually present, so the UI can show feedback only when it
// did something.
export function retryDecrypt(channelId: string, sessionId: string, deviceId: string): boolean {
	return undecryptableSessions.delete(undecryptableKey(channelId, sessionId, deviceId));
}

// Wipe everything the module is holding in memory. Called on logout so
// the next user signing in on the same install can't see (or be linked
// to) the previous user's plaintexts, verification states, or
// attachment keys.
const decryptFailureById = new Map<string, 'permanent' | 'error'>();

// Per-message decrypt-failure marker, read by the message bubble (step 5) to
// pick the placeholder + show a retry affordance only for 'error'. Recorded
// by the decrypt callers; cleared on success so a retry that succeeds drops
// the marker. Cleared on logout via clearAllMessageCaches.
export function recordDecryptFailure(messageId: string, outcome: DecryptionOutcome | null): void {
	if (outcome && outcome.status === 'failed') decryptFailureById.set(messageId, outcome.reason);
	else decryptFailureById.delete(messageId);
}

export function getDecryptFailure(messageId: string): 'permanent' | 'error' | null {
	return decryptFailureById.get(messageId) ?? null;
}

export function removeCachedMessagePlaintexts(messageIds: ReadonlyArray<string>): void {
	for (const messageId of messageIds) {
		sentPlaintextCache.delete(messageId);
		messageVerificationCache.delete(messageId);
		decryptFailureById.delete(messageId);
	}
	void deleteMessagePlaintexts(messageIds).catch((err: unknown) => {
		logger.warn('Failed to remove cached message plaintexts', {messageIds, err});
	});
}

export function clearAllMessageCaches(): void {
	attachmentKeyCache.clear();
	sentPlaintextCache.clear();
	sentEnvelopeEntriesByNonce.clear();
	messageVerificationCache.clear();
	undecryptableSessions.clear();
	decryptFailureById.clear();
}

export function recordAttachmentKeys(messageId: string, entries: ReadonlyArray<CachedAttachmentEntry>): void {
	if (entries.length === 0) return;
	let bucket = attachmentKeyCache.get(messageId);
	if (!bucket) {
		bucket = new Map();
		attachmentKeyCache.set(messageId, bucket);
	}
	for (const entry of entries) bucket.set(entry.id, entry);
	// Persist alongside the in-memory cache so attachments still decrypt
	// after a page refresh. Olm ratchets are one-shot, so without this
	// the bubble can never recover the AES key for a historical message.
	void putAttachmentKeys({
		message_id: messageId,
		entries: entries.map((e) => ({
			id: e.id,
			key: e.key,
			iv: e.iv,
			mime: e.mime,
			name: e.name,
			width: e.width,
			height: e.height,
		})),
		created_at: Date.now(),
	}).catch((err: unknown) => {
		logger.warn('Failed to persist attachment keys', {messageId, err});
	});
}

export function getAttachmentKey(messageId: string, attachmentId: string): CachedAttachmentEntry | null {
	return attachmentKeyCache.get(messageId)?.get(attachmentId) ?? null;
}

export function hasAttachmentKey(messageId: string, attachmentId: string): boolean {
	return attachmentKeyCache.get(messageId)?.has(attachmentId) ?? false;
}

// Lazy-load attachment keys from IDB for a message that's about to be
// rendered. Returns true if anything was hydrated. The bubble calls
// this on mount when hasAttachmentKey misses in memory — after this
// resolves, hasAttachmentKey/getAttachmentKey will return the durable
// entry.
export async function loadAttachmentKeysFromStorage(messageId: string): Promise<boolean> {
	if (attachmentKeyCache.has(messageId)) return true;
	try {
		const stored = await getAttachmentKeys(messageId);
		if (!stored || stored.entries.length === 0) return false;
		const bucket = new Map<string, CachedAttachmentEntry>();
		for (const entry of stored.entries) bucket.set(entry.id, entry);
		attachmentKeyCache.set(messageId, bucket);
		return true;
	} catch (err) {
		logger.warn('Failed to load attachment keys from storage', {messageId, err});
		return false;
	}
}

// Pair the envelope's order-matched attachment entries with the wire
// attachment array so the cache can be keyed by server attachment id.
// Truncates to the shorter of the two arrays in case the server
// dropped one of the uploads (oversize, virus scan, etc.) — those
// entries fall through to undefined-key which the renderer will treat
// as missing and surface via the placeholder.
export function pairEnvelopeAttachments(
	wireAttachments: ReadonlyArray<{id: string}>,
	envelopeEntries: ReadonlyArray<EnvelopeAttachmentEntry>,
): Array<CachedAttachmentEntry> {
	const out: Array<CachedAttachmentEntry> = [];
	const len = Math.min(wireAttachments.length, envelopeEntries.length);
	for (let i = 0; i < len; i++) {
		out.push({...envelopeEntries[i], id: wireAttachments[i].id});
	}
	return out;
}

// Returns null if the channel isn't E2EE-eligible (not a 1:1 DM, missing
// own keys, recipient lacks any E2EE devices, etc.) so the caller can
// fall through to plaintext send. Group DMs and guild channels are
// deliberately excluded for phase 1 — group sessions need MLS and that's
// a separate slice.
// Returns true if at least one of the given devices doesn't yet have a
// stored Olm session. Used to skip the prekey-claim round trip for chatty
// DMs where every peer device is already keyed up — the common case.
async function anyDeviceWithoutSession(
	userId: string,
	devices: ReadonlyArray<{device_id: string}>,
): Promise<boolean> {
	for (const d of devices) {
		const sessions = await getSessionsForRemoteDevice(userId, d.device_id);
		if (sessions.length === 0) return true;
	}
	return false;
}

export async function tryEncryptForChannel(
	channel: ChannelRecord,
	currentUserId: string,
	plaintext: string,
	attachments?: ReadonlyArray<EnvelopeAttachmentEntry>,
): Promise<EncryptedSendResult | null> {
	if (!E2EEStore.isReady) return null;
	if (!SUPPORTED_CHANNEL_TYPES.has(channel.type)) return null;

	const ownDeviceId = E2EEStore.deviceId;
	if (!ownDeviceId) return null;

	// Group DMs use Megolm — one ratcheting session per channel, the
	// session_key distributed to each recipient device via Olm. 1:1 DMs
	// keep the per-device Olm fan-out (lower per-message overhead when
	// recipient has many devices, since Megolm shines at >2 members).
	if (channel.type === ChannelTypes.GROUP_DM) {
		return tryEncryptForGroupDm(channel, currentUserId, ownDeviceId, plaintext, attachments);
	}

	const recipientIds = channel.recipientIds.filter((id) => id !== currentUserId);
	if (recipientIds.length !== 1) return null;
	const recipientId = recipientIds[0];

	// Only call the prekey-claim endpoint when we actually need to start a
	// new session with a device. For a chatty DM where we already have Olm
	// sessions with every peer device, this collapses two HTTP round trips
	// (with prekey consumption) to zero per send. We still hit the cheap
	// /devices list endpoint so we pick up new devices and detect identity
	// rotations.
	//
	// loadOrCreateOutboundSession returns the existing session when one is
	// stored, so we only attach a one_time_prekey to the bundle for devices
	// that lack a session.
	let recipientDevices;
	let ownDevices;
	try {
		[recipientDevices, ownDevices] = await Promise.all([
			E2EEActionCreators.listPublicDevices(recipientId),
			E2EEActionCreators.listPublicDevices(currentUserId),
		]);
	} catch (error) {
		logger.warn('Failed to list peer devices, falling back to plaintext', {error});
		return null;
	}

	if (!recipientDevices.length) return null;

	const needsClaimForRecipient = await anyDeviceWithoutSession(recipientId, recipientDevices);
	const needsClaimForSelf = await anyDeviceWithoutSession(currentUserId, ownDevices);

	let recipientClaims: ReadonlyArray<E2EEActionCreators.E2EEPrekeyBundleResponse> = [];
	let ownClaims: ReadonlyArray<E2EEActionCreators.E2EEPrekeyBundleResponse> = [];
	try {
		[recipientClaims, ownClaims] = await Promise.all([
			needsClaimForRecipient ? E2EEActionCreators.claimPrekeyBundles(recipientId) : Promise.resolve([]),
			needsClaimForSelf ? E2EEActionCreators.claimPrekeyBundles(currentUserId) : Promise.resolve([]),
		]);
	} catch (error) {
		logger.warn('Failed to claim prekey bundles, falling back to plaintext', {error});
		return null;
	}

	// Build target bundles from the device list, layering any freshly
	// claimed prekeys on top. Devices without a fresh claim still get a
	// bundle entry — `one_time_prekey: null` is fine when an existing
	// session is loaded from IDB instead.
	const claimByKey = new Map<string, E2EEActionCreators.E2EEPrekeyBundleResponse>();
	for (const c of [...recipientClaims, ...ownClaims]) {
		claimByKey.set(`${c.user_id}:${c.device_id}`, c);
	}
	// Include the sender's own device in the fan-out so the sender can
	// decrypt their own messages after a page refresh. Without this slot
	// the in-memory sentPlaintext cache is the only thing keeping our
	// own bubbles readable, and that cache dies with the tab.
	const targetBundles = [...recipientDevices, ...ownDevices].map((d) => {
		const claim = claimByKey.get(`${d.user_id}:${d.device_id}`);
		return {
			user_id: d.user_id,
			device_id: d.device_id,
			identity_key: d.identity_key,
			registration_id: d.registration_id,
			signed_prekey: d.signed_prekey,
			one_time_prekey: claim?.one_time_prekey ?? null,
		};
	});

	// Detect peer identity rotation: if a device's published
	// identity_key has changed since we last cached one, any locally
	// stored Olm session for that device was tied to the old identity
	// and is now dead. Wipe those sessions so loadOrCreateOutboundSession
	// builds a fresh one against the current keys.
	for (const bundle of targetBundles) {
		try {
			const cached = await getPeerIdentityKey(bundle.user_id, bundle.device_id);
			if (cached !== null && cached !== bundle.identity_key) {
				logger.info('Peer identity rotated, dropping stored sessions', {
					userId: bundle.user_id,
					deviceId: bundle.device_id,
				});
				await deleteSessionsForRemoteDevice(bundle.user_id, bundle.device_id);
			}
			if (cached !== bundle.identity_key) {
				await setPeerIdentityKey(bundle.user_id, bundle.device_id, bundle.identity_key);
			}
		} catch (error) {
			logger.warn('Peer identity check failed, proceeding without rotation guard', {error});
		}
	}

	if (targetBundles.length === 0) {
		// Nobody to send to (recipient has no devices and we're alone). The
		// channel can't be encrypted today; let the caller fall back so the
		// user isn't blocked.
		return null;
	}

	let encryptedMessages;
	try {
		encryptedMessages = await e2eeManager.encryptForBundles(
			targetBundles,
			wrapPlaintext(plaintext, attachments),
		);
	} catch (error) {
		logger.warn('Encryption failed, falling back to plaintext', {error});
		return null;
	}

	const ciphertexts: Record<string, {type: number; body: string}> = {};
	for (let i = 0; i < targetBundles.length; i++) {
		const bundle = targetBundles[i];
		const enc = encryptedMessages[i];
		if (!enc) continue;
		ciphertexts[`${bundle.user_id}:${bundle.device_id}`] = {type: enc.type, body: enc.body};
	}

	// If every bundle was unreachable (claim returned no prekeys for any
	// peer device, Olm refused all of them) the message would go out
	// with no ciphertext slots — a black hole. Surface as a regular
	// encrypt failure so the caller can prompt for plaintext fallback.
	if (Object.keys(ciphertexts).length === 0) {
		logger.warn('No reachable peer devices for encrypt');
		return null;
	}

	// Use any of our own device entries to fish out our identity key — they
	// all share the same one because they all originate from the same Olm
	// account. This avoids exposing a separate accessor on the manager.
	const senderDevice = ownDevices.find((d) => d.device_id === ownDeviceId);
	const finalSenderIdentityKey = senderDevice?.identity_key ?? '';

	// Each pre-key message consumes one of the recipient's published
	// one-time prekeys. New sessions pop ours too. Schedule a throttled
	// /devices check so a chatty session keeps the queue topped up
	// without us hammering the server.
	E2EEStore.scheduleReplenishCheck();

	return {
		content: '',
		flags_to_set: 0, // caller sets MessageFlags.ENCRYPTED itself
		encrypted_payload: {
			v: 1,
			sender_device_id: ownDeviceId,
			sender_identity_key: finalSenderIdentityKey,
			ciphertexts,
		},
	};
}

// Group DM encryption — Megolm session + Olm-wrapped key distribution.
//
// 1. Get/create the outbound Megolm session for this channel. If we just
//    created one (isNew), we need to fan the session_key out to every
//    recipient device before we can send so receivers can decrypt.
// 2. Build the wrapped plaintext (same envelope as 1:1 so attachment
//    keys ride along).
// 3. encryptGroupMessage produces a single ciphertext + session_id.
// 4. Wire shape uses the EncryptedPayloadMegolm discriminator so the
//    receive path knows to branch on session_id rather than per-device
//    ciphertexts.
// Builds a stable fingerprint of the current recipient device set for a
// channel. Sorted so different orderings produce the same hash; hashed
// so the value stored alongside the outbound session stays small even
// for large groups. Failures to fetch a member's device list contribute
// an empty list to the hash — same outcome as "no devices" — which is
// safe: a recovered device list on the next send will change the hash
// and trigger rotation then.
async function computeRecipientSetHash(memberUserIds: ReadonlyArray<string>): Promise<string> {
	const allDeviceKeys: Array<string> = [];
	const devicesPerMember = await Promise.all(
		memberUserIds.map(async (uid) => {
			try {
				return await E2EEActionCreators.listPublicDevices(uid);
			} catch {
				return [];
			}
		}),
	);
	for (let i = 0; i < memberUserIds.length; i++) {
		const uid = memberUserIds[i];
		for (const d of devicesPerMember[i]) {
			allDeviceKeys.push(`${uid}|${d.device_id}`);
		}
	}
	allDeviceKeys.sort();
	const encoded = new TextEncoder().encode(allDeviceKeys.join('\n'));
	const digest = await crypto.subtle.digest('SHA-256', encoded);
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function tryEncryptForGroupDm(
	channel: ChannelRecord,
	currentUserId: string,
	ownDeviceId: string,
	plaintext: string,
	attachments?: ReadonlyArray<EnvelopeAttachmentEntry>,
): Promise<EncryptedSendResult | null> {
	const otherRecipientIds = channel.recipientIds.filter((id) => id !== currentUserId);
	// A "group DM" with only the local user is degenerate — there's nobody
	// to encrypt to, so fall through to plaintext (which the channel
	// toggle will eventually prevent at the UI level).
	if (otherRecipientIds.length === 0) return null;

	// Compute the current recipient-device set across all members. This is
	// the source-of-truth for "who should hold the current session_key".
	// We hash it and compare against what we stored on the cached outbound
	// session — if the set has changed (peer rotated devices, new install,
	// stale dead device retired), we drop the cached session so the next
	// send creates a fresh one and redistributes to everyone currently
	// present. Without this rotation, a previously-cached session sticks
	// around forever and never reaches devices that registered after it
	// was created.
	const memberUserIds = [...otherRecipientIds, currentUserId];
	const currentRecipientHash = await computeRecipientSetHash(memberUserIds);

	const cachedSession = await getOutboundGroupSession(channel.id);
	if (cachedSession && cachedSession.recipient_set_hash !== currentRecipientHash) {
		logger.info('Recipient device set changed, rotating outbound group session', {
			channelId: channel.id,
			previousHash: cachedSession.recipient_set_hash ?? '(unset)',
			currentHash: currentRecipientHash,
		});
		await deleteOutboundGroupSession(channel.id);
	}

	const sessionInfo = await e2eeManager.getOrCreateOutboundGroupSession(channel.id);

	// Fetch sender's own identity key for the payload (recipients use it
	// to verify the sender device's Olm identity matches what the server
	// advertised when they bootstrap the inbound session).
	const ownDevices = await E2EEActionCreators.listPublicDevices(currentUserId);
	const senderDevice = ownDevices.find((d) => d.device_id === ownDeviceId);
	const senderIdentityKey = senderDevice?.identity_key ?? '';

	if (sessionInfo.isNew) {
		// Distribute the freshly-created session key to every recipient
		// device (and our own other devices so this device can self-read
		// after a reload). Each recipient device gets a small Olm-encrypted
		// blob carrying the Megolm session_key.
		const distributed = await distributeGroupSessionToAllMembers({
			channelId: channel.id,
			senderUserId: currentUserId,
			senderDeviceId: ownDeviceId,
			senderIdentityKey,
			sessionId: sessionInfo.sessionId,
			sessionKey: sessionInfo.sessionKey,
			memberUserIds,
		});
		if (!distributed) {
			// Couldn't reach any recipient device — fall back to plaintext
			// rather than send an undecryptable message.
			logger.warn('Failed to distribute new group session, falling back to plaintext', {channelId: channel.id});
			return null;
		}

		// Record which recipient set this freshly-distributed session was
		// addressed to. Future sends compare against this hash to know when
		// rotation is required.
		const fresh = await getOutboundGroupSession(channel.id);
		if (fresh) {
			await putOutboundGroupSession({...fresh, recipient_set_hash: currentRecipientHash});
		}
	}

	// Self-readback: Megolm outbound sessions are encrypt-only — they
	// can't decrypt the ciphertexts they produce. Without this step,
	// reloading the page makes our own messages display as
	// "could not be decrypted on this device" while everyone else's
	// messages are readable (they bootstrapped inbound sessions from
	// the blobs we distributed). Ensure an inbound copy of our own
	// current outbound exists in IDB so refreshes can decrypt the
	// messages we send.
	//
	// Critically: only import if one isn't already stored. The
	// outbound's session_key() returns the key at the CURRENT ratchet
	// position; importing into IDB now would overwrite an older,
	// lower-index inbound that already covers earlier messages.
	// Skipping the import when an inbound already exists preserves
	// whatever earliest-known-index we already had.
	try {
		const existingInbound = await getInboundGroupSession(
			channel.id,
			currentUserId,
			ownDeviceId,
			sessionInfo.sessionId,
		);
		if (!existingInbound) {
			await e2eeManager.importInboundGroupSession({
				channelId: channel.id,
				senderUserId: currentUserId,
				senderDeviceId: ownDeviceId,
				senderIdentityKey,
				sessionKey: sessionInfo.sessionKey,
			});
		}
	} catch (err) {
		logger.warn('Failed to self-import outbound session for readback', {channelId: channel.id, err});
		// Not fatal — sending still works, the user just won't see
		// their own history after a refresh.
	}

	let encrypted;
	try {
		encrypted = await e2eeManager.encryptGroupMessage(channel.id, wrapPlaintext(plaintext, attachments));
	} catch (err) {
		logger.warn('Group encrypt failed, falling back to plaintext', {channelId: channel.id, err});
		return null;
	}

	E2EEStore.scheduleReplenishCheck();

	return {
		content: '',
		flags_to_set: 0,
		encrypted_payload: {
			v: 1,
			kind: 'megolm',
			sender_device_id: ownDeviceId,
			sender_identity_key: senderIdentityKey,
			session_id: encrypted.sessionId,
			ciphertext: encrypted.ciphertext,
		},
	};
}

// Encrypts the Megolm session_key to every device of every member via
// 1:1 Olm sessions, then POSTs the blobs to the server in one request.
// Returns false if no blobs could be built at all; partial fan-out is
// still considered success — late-joining devices can pick up later
// sessions on the next message.
async function distributeGroupSessionToAllMembers(params: {
	channelId: string;
	senderUserId: string;
	senderDeviceId: string;
	senderIdentityKey: string;
	sessionId: string;
	sessionKey: string;
	memberUserIds: ReadonlyArray<string>;
}): Promise<boolean> {
	const allDevicesByMember = await Promise.all(
		params.memberUserIds.map(async (uid) => {
			try {
				return {uid, devices: await E2EEActionCreators.listPublicDevices(uid)};
			} catch (err) {
				logger.warn('Failed to list devices for group session distribution', {uid, err});
				return {uid, devices: []};
			}
		}),
	);

	// Collect bundles we'll need to build Olm sessions with — same logic
	// as the 1:1 encrypt path: only claim a prekey when no existing
	// session covers the device.
	const claimsToFetch = new Set<string>();
	for (const {uid, devices} of allDevicesByMember) {
		for (const d of devices) {
			// Skip the sender's own device — encryptForBundles handles fan-out
			// to other own devices, but a device can't Olm-encrypt to itself
			// without confusion. The local IDB already has the session_key
			// from getOrCreateOutboundGroupSession.
			if (uid === params.senderUserId && d.device_id === params.senderDeviceId) continue;
			const existing = await getSessionsForRemoteDevice(uid, d.device_id);
			if (existing.length === 0) claimsToFetch.add(uid);
		}
	}

	const claimsByUser = new Map<string, ReadonlyArray<E2EEActionCreators.E2EEPrekeyBundleResponse>>();
	await Promise.all(
		Array.from(claimsToFetch).map(async (uid) => {
			try {
				claimsByUser.set(uid, await E2EEActionCreators.claimPrekeyBundles(uid));
			} catch (err) {
				logger.warn('Failed to claim prekey bundles for group distribution', {uid, err});
				claimsByUser.set(uid, []);
			}
		}),
	);

	const bundles: Array<{
		user_id: string;
		device_id: string;
		identity_key: string;
		registration_id: number;
		signed_prekey: {id: number; public_key: string; signature: string};
		one_time_prekey: {id: number; public_key: string} | null;
	}> = [];
	for (const {uid, devices} of allDevicesByMember) {
		const userClaims = claimsByUser.get(uid) ?? [];
		const claimByDevice = new Map(userClaims.map((c) => [c.device_id, c]));
		for (const d of devices) {
			if (uid === params.senderUserId && d.device_id === params.senderDeviceId) continue;
			const claim = claimByDevice.get(d.device_id);
			bundles.push({
				user_id: uid,
				device_id: d.device_id,
				identity_key: d.identity_key,
				registration_id: d.registration_id,
				signed_prekey: d.signed_prekey,
				one_time_prekey: claim?.one_time_prekey ?? null,
			});
		}
	}

	if (bundles.length === 0) {
		logger.warn('No recipient devices to distribute group session to', {channelId: params.channelId});
		return false;
	}

	// Wrap the session_key in a small JSON envelope so future fields (key
	// expiration, room context, etc.) can be added without changing the
	// Olm-level wire shape.
	const sessionKeyPayload = JSON.stringify({
		v: 1,
		channel_id: params.channelId,
		session_id: params.sessionId,
		session_key: params.sessionKey,
	});

	let encrypted;
	try {
		encrypted = await e2eeManager.encryptForBundles(bundles, sessionKeyPayload);
	} catch (err) {
		logger.warn('Encrypting group session_key to recipient devices failed', {err});
		return false;
	}

	const recipientBlobs: Array<E2EEActionCreators.E2EEGroupSessionBlob> = [];
	for (let i = 0; i < bundles.length; i++) {
		const bundle = bundles[i];
		const enc = encrypted[i];
		if (!enc) continue;
		recipientBlobs.push({
			recipient_user_id: bundle.user_id,
			recipient_device_id: bundle.device_id,
			olm_message_type: enc.type as 0 | 1,
			olm_ciphertext: enc.body,
		});
	}

	if (recipientBlobs.length === 0) {
		logger.warn('All Olm encrypts failed for group session distribution', {channelId: params.channelId});
		return false;
	}

	try {
		await E2EEActionCreators.distributeGroupSession(params.channelId, {
			session_id: params.sessionId,
			sender_device_id: params.senderDeviceId,
			sender_identity_key: params.senderIdentityKey,
			recipient_blobs: recipientBlobs,
		});
	} catch (err) {
		logger.warn('POST group-sessions failed', {err});
		return false;
	}

	return true;
}

export interface DecryptionResult {
	plaintext: string;
	attachments: Array<EnvelopeAttachmentEntry>;
	verificationStatus: 'verified' | 'changed' | 'unverified';
}

// Discriminated result of a decrypt attempt. 'permanent' → message can't be
// read on this device (no blob: pre-join/lost session, or any 1:1 failure) —
// no retry affordance. 'error' → a retryable technical failure in the group
// path (network error listing blobs, or decrypt threw after a successful
// session import).
export type DecryptionOutcome =
	| {status: 'ok'; result: DecryptionResult}
	| {status: 'failed'; reason: 'permanent' | 'error'};

const PERMANENT_FAILURE: DecryptionOutcome = {status: 'failed', reason: 'permanent'};
const ERROR_FAILURE: DecryptionOutcome = {status: 'failed', reason: 'error'};

export const ENCRYPTED_FAILURE_PERMANENT_PLACEHOLDER =
	'\ud83d\udd12 This message cannot be read on this device.';
export const ENCRYPTED_FAILURE_ERROR_PLACEHOLDER =
	'\u26a0\ufe0f This message could not be decrypted (technical error).';
export const ENCRYPTED_KEY_CHANGED_PREFIX =
	'\u26a0\ufe0f Identity key changed since you last verified — re-verify before trusting this message.';

// Builds the user-visible content string for an incoming or historical
// encrypted message: plaintext on success, a failure placeholder on
// decrypt failure, and a re-verify warning prepended when the sender's
// identity key has rotated since the last verification.
export function buildDecryptedContent(outcome: DecryptionOutcome): string {
	if (outcome.status === 'ok') {
		const r = outcome.result;
		return r.verificationStatus === 'changed'
			? `${ENCRYPTED_KEY_CHANGED_PREFIX}\n\n${r.plaintext}`
			: r.plaintext;
	}
	return outcome.reason === 'error'
		? ENCRYPTED_FAILURE_ERROR_PLACEHOLDER
		: ENCRYPTED_FAILURE_PERMANENT_PLACEHOLDER;
}

export async function tryDecryptForCurrentDevice(
	currentUserId: string,
	senderUserId: string,
	encryptedPayload: EncryptedPayload | null | undefined,
	channelId?: string,
	messageId?: string,
	consultFailureCache = false,
): Promise<DecryptionOutcome> {
	if (!encryptedPayload) return PERMANENT_FAILURE;

	// Plaintext cache check — Olm and Megolm both consume per-message
	// material on decrypt, so a refresh that re-fetches the same
	// ciphertext can't re-decrypt. Read the post-first-decrypt plaintext
	// from IDB if we have it. This runs BEFORE the isReady gate because
	// the cache is just an IDB read and doesn't need Olm; otherwise a
	// PWA cold-start race ends up rendering "can't decrypt" for every
	// message in history while Olm is still bootstrapping.
	if (messageId) {
		try {
			const cached = await getMessagePlaintext(messageId);
			if (cached) {
				return {status: 'ok', result: {
					plaintext: cached.plaintext,
					attachments: cached.attachments ? [...cached.attachments] : [],
					verificationStatus: cached.verification_status ?? 'unverified',
				}};
			}
		} catch (err) {
			logger.warn('Plaintext cache read failed; falling through to decrypt', {messageId, err});
		}
	}

	// Bootstrap race on the live path: a gateway message can land before Olm
	// finishes registering. This is transient, so it must NOT be reported as a
	// permanent failure — 'permanent' renders the dead 🔒 placeholder and the
	// bubble deliberately withholds the retry button for it, leaving the
	// message unreadable until a full reload clears the in-memory marker.
	// 'error' renders ⚠ + Retry, which succeeds once registration completes.
	if (!E2EEStore.isReady) return ERROR_FAILURE;
	// isReady already implies deviceId !== null; this only narrows the type.
	const deviceId = E2EEStore.deviceId;
	if (!deviceId) return ERROR_FAILURE;

	// Megolm group DM message — single ciphertext, identified by session.
	if (encryptedPayload.kind === 'megolm') {
		if (!channelId) {
			logger.warn('Megolm message received without channel context, cannot decrypt');
			return PERMANENT_FAILURE;
		}
		const outcome = await tryDecryptGroupMessage({
			channelId,
			currentUserId,
			currentDeviceId: deviceId,
			senderUserId,
			payload: encryptedPayload,
			consultFailureCache,
		});
		return outcome;
	}

	// 1:1 Olm fan-out — find this device's ciphertext slot.
	const slot = `${currentUserId}:${deviceId}`;
	const ciphertext = encryptedPayload.ciphertexts[slot];
	if (!ciphertext) return PERMANENT_FAILURE;

	try {
		const decrypted = await e2eeManager.decrypt(
			senderUserId,
			encryptedPayload.sender_device_id,
			encryptedPayload.sender_identity_key,
			{
				device_id: encryptedPayload.sender_device_id,
				type: ciphertext.type === 1 ? 1 : 0,
				body: ciphertext.body,
			},
		);
		const verificationStatus = await E2EEStore.checkVerificationStatusAsync(
			senderUserId,
			encryptedPayload.sender_device_id,
			encryptedPayload.sender_identity_key,
		);
		const unwrapped = unwrapPlaintext(decrypted);
		const result: DecryptionResult = {
			plaintext: unwrapped.text,
			attachments: unwrapped.attachments,
			verificationStatus,
		};
		return {status: 'ok', result};
	} catch (error) {
		logger.warn('Failed to decrypt incoming message', {error});
		return PERMANENT_FAILURE; // 1:1 has no fetch-retry mechanism
	}
}

// Megolm decrypt path. On miss (no inbound session stored), fetch the
// pending session-key blobs for this channel from the server, decrypt
// the Olm envelope for the matching session_id, import the Megolm
// session, ack the blob, then decrypt the message.
async function tryDecryptGroupMessage(params: {
	channelId: string;
	currentUserId: string;
	currentDeviceId: string;
	senderUserId: string;
	payload: EncryptedPayloadMegolm;
	consultFailureCache?: boolean;
}): Promise<DecryptionOutcome> {
	const {channelId, currentUserId, currentDeviceId, senderUserId, payload, consultFailureCache = false} = params;

	// Short-circuit messages already known permanently undecryptable on this
	// device (no blob targets us). Gated on consultFailureCache so only the
	// history-fetch path skips; the live MESSAGE_CREATE path always attempts,
	// avoiding a join-race where a blob lands moments after a live message.
	// consultFailureCache is threaded from callers in step 3 — until then
	// this is inert (default false), so step 2 changes no behavior.
	if (consultFailureCache && isSessionUndecryptable(channelId, payload.session_id, currentDeviceId)) {
		return PERMANENT_FAILURE;
	}

	const tryDecrypt = async () => {
		const result = await e2eeManager.decryptGroupMessage({
			channelId,
			senderUserId,
			senderDeviceId: payload.sender_device_id,
			sessionId: payload.session_id,
			ciphertext: payload.ciphertext,
		});
		const verificationStatus = await E2EEStore.checkVerificationStatusAsync(
			senderUserId,
			payload.sender_device_id,
			payload.sender_identity_key,
		);
		const unwrapped = unwrapPlaintext(result.plaintext);
		return {plaintext: unwrapped.text, attachments: unwrapped.attachments, verificationStatus};
	};

	try {
		return {status: 'ok', result: await tryDecrypt()};
	} catch (err) {
		logger.debug('Group session not yet imported, fetching from server', {
			channelId,
			sessionId: payload.session_id,
			err,
		});
	}

	// Try to fetch + import the matching session blob.
	const importResult = await fetchAndImportGroupSessionFor({
		channelId,
		currentUserId,
		currentDeviceId,
		sessionId: payload.session_id,
		senderDeviceId: payload.sender_device_id,
	});
	if (importResult !== 'imported') {
		// Genuine "no blob for this device" is permanent (forward secrecy /
		// pre-join), so cache it — re-renders/scrolls/jumps stop re-fetching.
		// Never cache 'network_error' (transient — retry on next fetch).
		if (importResult === 'no_blob') {
			markSessionUndecryptable(channelId, payload.session_id, currentDeviceId);
		}
		logger.warn('No group session blob available for message', {
			channelId,
			sessionId: payload.session_id,
			reason: importResult,
		});
		// no_blob → permanent (🔒); network_error → retryable error (⚠ + retry).
		return importResult === 'no_blob' ? PERMANENT_FAILURE : ERROR_FAILURE;
	}

	try {
		return {status: 'ok', result: await tryDecrypt()};
	} catch (err) {
		logger.warn('Group decrypt failed even after import', {channelId, sessionId: payload.session_id, err});
		return ERROR_FAILURE; // imported but still failed = technical error
	}
}

// Result of attempting to fetch + import a group session blob:
//   'imported'      — the target session_key was imported; decrypt can retry
//   'no_blob'       — no blob targets this device (permanent: pre-join or
//                     lost session) — safe to negatively cache
//   'network_error' — listing the blobs failed (transient) — do NOT cache
type GroupSessionImportResult = 'imported' | 'no_blob' | 'network_error';

// Fetches all pending group-session blobs for this channel + this user,
// decrypts each via Olm, imports the resulting Megolm session_key, and
// acks the blob server-side. Returns 'imported' only if the target session
// was imported; 'no_blob' if no matching blob exists for this device;
// 'network_error' if the blob listing failed.
async function fetchAndImportGroupSessionFor(params: {
	channelId: string;
	currentUserId: string;
	currentDeviceId: string;
	sessionId: string;
	senderDeviceId: string;
}): Promise<GroupSessionImportResult> {
	let blobs;
	try {
		blobs = await E2EEActionCreators.listInboundGroupSessions(params.channelId);
	} catch (err) {
		logger.warn('Failed to list inbound group sessions', {err});
		return 'network_error';
	}

	let importedTarget = false;
	for (const blob of blobs) {
		if (blob.recipient_device_id !== params.currentDeviceId) continue;
		try {
			const decryptedPayload = await e2eeManager.decrypt(
				blob.sender_user_id,
				blob.sender_device_id,
				blob.sender_identity_key,
				{
					device_id: blob.sender_device_id,
					type: blob.olm_message_type === 1 ? 1 : 0,
					body: blob.olm_ciphertext,
				},
			);
			const parsed = JSON.parse(decryptedPayload) as {
				v: number;
				channel_id: string;
				session_id: string;
				session_key: string;
			};
			await e2eeManager.importInboundGroupSession({
				channelId: parsed.channel_id,
				senderUserId: blob.sender_user_id,
				senderDeviceId: blob.sender_device_id,
				senderIdentityKey: blob.sender_identity_key,
				sessionKey: parsed.session_key,
			});
			// Ack — server can GC. Best-effort; if the ack fails we'll
			// just re-process the same blob on the next miss, which is
			// idempotent thanks to importInboundGroupSession's put.
			void E2EEActionCreators.ackGroupSessionBlob(
				params.channelId,
				blob.session_id,
				blob.recipient_device_id,
				blob.sender_device_id,
			).catch((err) =>
				logger.debug('Group session blob ack failed (will retry next miss)', {err}),
			);
			if (blob.session_id === params.sessionId && blob.sender_device_id === params.senderDeviceId) {
				importedTarget = true;
			}
		} catch (err) {
			logger.warn('Failed to import a group session blob', {
				sessionId: blob.session_id,
				senderDevice: blob.sender_device_id,
				err,
			});
		}
	}

	return importedTarget ? 'imported' : 'no_blob';
}

// ── Membership-change rotation hooks ────────────────────────────────────
// Wired into CHANNEL_RECIPIENT_ADD/REMOVE gateway handlers. Only sender
// devices have an outbound session for a given channel — receivers just
// hold inbound sessions per sender — so the early-out on "do we have an
// outbound session" naturally scopes these to do work on the right
// clients.

// A new member just joined a group DM. If we're a sender (we have an
// active outbound session for this channel), distribute the current
// session_key to the new member's devices so they can decrypt subsequent
// messages we send. Past messages stay inaccessible to them (Megolm is
// forward-secret at the session_key the new member receives).
export async function handleGroupDmMemberAdded(params: {
	channelId: string;
	addedUserId: string;
}): Promise<void> {
	if (!E2EEStore.isReady) return;
	const ownDeviceId = E2EEStore.deviceId;
	const ownUserId = E2EEStore.currentUserId;
	if (!ownDeviceId || !ownUserId) return;

	const stored = await getOutboundGroupSession(params.channelId);
	if (!stored) return; // we haven't sent anything in this channel — nothing to share yet

	// Re-pull the live session_key from the manager so we get whatever
	// session is current (handles the race where the outbound was just
	// rotated by a remove-then-add).
	let sessionInfo;
	try {
		sessionInfo = await e2eeManager.getOrCreateOutboundGroupSession(params.channelId);
	} catch (err) {
		logger.warn('handleGroupDmMemberAdded: failed to load outbound session', {err});
		return;
	}

	const ownDevices = await E2EEActionCreators.listPublicDevices(ownUserId);
	const senderDevice = ownDevices.find((d) => d.device_id === ownDeviceId);
	const senderIdentityKey = senderDevice?.identity_key ?? '';

	// Distribute ONLY to the newly added member — existing members
	// already have the session imported.
	await distributeGroupSessionToAllMembers({
		channelId: params.channelId,
		senderUserId: ownUserId,
		senderDeviceId: ownDeviceId,
		senderIdentityKey,
		sessionId: sessionInfo.sessionId,
		sessionKey: sessionInfo.sessionKey,
		memberUserIds: [params.addedUserId],
	});
}

// A member just left (or was removed from) a group DM. If we have an
// outbound session for this channel, wipe it — the next encrypt will
// build and distribute a fresh session that excludes the removed
// member's devices. Their stored session_key for the OLD session
// remains valid for messages we already sent (can't take that back
// once it's encrypted), but they will not be able to decrypt anything
// from the new session.
export async function handleGroupDmMemberRemoved(params: {
	channelId: string;
}): Promise<void> {
	if (!E2EEStore.isReady) return;
	try {
		await deleteOutboundGroupSession(params.channelId);
	} catch (err) {
		logger.warn('handleGroupDmMemberRemoved: failed to wipe outbound session', {err});
	}
}

// Channel was un-encrypted (e2ee toggled off) or removed entirely. Wipe
// all stored Megolm material for the channel — both our outbound and
// any inbound sessions from other senders.
export async function handleGroupDmEncryptionDisabled(channelId: string): Promise<void> {
	try {
		await deleteAllGroupSessionsForChannel(channelId);
	} catch (err) {
		logger.warn('handleGroupDmEncryptionDisabled: failed to wipe channel sessions', {err});
	}
}
