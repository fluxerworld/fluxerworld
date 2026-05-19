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
	deleteSessionsForRemoteDevice,
	getCachedMessagePlaintext,
	getPeerIdentityKey,
	putCachedMessagePlaintext,
	setPeerIdentityKey,
} from '@app/lib/e2ee/E2EEKeyStore';
import {e2eeManager} from '@app/lib/e2ee/E2EEManager';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import E2EEStore from '@app/stores/E2EEStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';

const logger = new Logger('E2EEMessageIntegration');

export interface EncryptedPayload {
	v: number;
	sender_device_id: string;
	sender_identity_key: string;
	ciphertexts: Record<string, {type: number; body: string}>;
}

export interface EncryptedSendResult {
	content: string;
	flags_to_set: number;
	encrypted_payload: EncryptedPayload;
}

const SUPPORTED_CHANNEL_TYPES = new Set<number>([ChannelTypes.DM]);

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

// Control messages travel inside the same Olm envelope as content. They
// signal a per-DM state change to the peer (currently just E2EE off) and
// are processed instead of being rendered as a chat bubble. Authenticated
// + tamper-evident because they ride the encrypted path.
export type E2EEControl = 'e2ee_off';

interface EnvelopePayloadV2 {
	v: 2;
	text: string;
	attachments?: Array<EnvelopeAttachmentEntry>;
	control?: E2EEControl;
}

interface UnwrappedPlaintext {
	text: string;
	attachments: Array<EnvelopeAttachmentEntry>;
	control: E2EEControl | null;
}

function wrapPlaintext(
	text: string,
	attachments?: ReadonlyArray<EnvelopeAttachmentEntry>,
	control?: E2EEControl,
): string {
	const envelope: EnvelopePayloadV2 = {v: 2, text};
	if (attachments && attachments.length > 0) envelope.attachments = [...attachments];
	if (control) envelope.control = control;
	return JSON.stringify(envelope);
}

// Reverse of wrapPlaintext, with a v1 fallback so messages from older
// senders (raw strings) keep decrypting cleanly. The detection is
// deliberately strict — only a JSON object with v === 2 and a string
// text counts as v2; anything else is treated as a v1 raw string. That
// way a user who legitimately types `{"v":1,"text":"hi"}` as their
// actual message body doesn't get mis-parsed.
function unwrapPlaintext(decrypted: string): UnwrappedPlaintext {
	if (decrypted.length === 0 || decrypted[0] !== '{') return {text: decrypted, attachments: [], control: null};
	try {
		const parsed = JSON.parse(decrypted) as Partial<EnvelopePayloadV2>;
		if (parsed && parsed.v === 2 && typeof parsed.text === 'string') {
			const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
			const control = parsed.control === 'e2ee_off' ? 'e2ee_off' : null;
			return {text: parsed.text, attachments, control};
		}
	} catch {
		// JSON parse failures fall through to v1.
	}
	return {text: decrypted, attachments: [], control: null};
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

// Wipe everything the module is holding in memory. Called on logout so
// the next user signing in on the same install can't see (or be linked
// to) the previous user's plaintexts, verification states, or
// attachment keys.
export function clearAllMessageCaches(): void {
	attachmentKeyCache.clear();
	sentPlaintextCache.clear();
	sentEnvelopeEntriesByNonce.clear();
	messageVerificationCache.clear();
}

export function recordAttachmentKeys(messageId: string, entries: ReadonlyArray<CachedAttachmentEntry>): void {
	if (entries.length === 0) return;
	let bucket = attachmentKeyCache.get(messageId);
	if (!bucket) {
		bucket = new Map();
		attachmentKeyCache.set(messageId, bucket);
	}
	for (const entry of entries) bucket.set(entry.id, entry);
}

export function getAttachmentKey(messageId: string, attachmentId: string): CachedAttachmentEntry | null {
	return attachmentKeyCache.get(messageId)?.get(attachmentId) ?? null;
}

export function hasAttachmentKey(messageId: string, attachmentId: string): boolean {
	return attachmentKeyCache.get(messageId)?.has(attachmentId) ?? false;
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
export async function tryEncryptForChannel(
	channel: ChannelRecord,
	currentUserId: string,
	plaintext: string,
	attachments?: ReadonlyArray<EnvelopeAttachmentEntry>,
	control?: E2EEControl,
): Promise<EncryptedSendResult | null> {
	if (!E2EEStore.isReady) return null;
	if (!SUPPORTED_CHANNEL_TYPES.has(channel.type)) return null;

	const ownDeviceId = E2EEStore.deviceId;
	if (!ownDeviceId) return null;

	const recipientIds = channel.recipientIds.filter((id) => id !== currentUserId);
	if (recipientIds.length !== 1) return null;
	const recipientId = recipientIds[0];

	let recipientBundles;
	let ownBundles;
	try {
		[recipientBundles, ownBundles] = await Promise.all([
			E2EEActionCreators.claimPrekeyBundles(recipientId),
			E2EEActionCreators.claimPrekeyBundles(currentUserId),
		]);
	} catch (error) {
		logger.warn('Failed to claim prekey bundles, falling back to plaintext', {error});
		return null;
	}

	if (!recipientBundles.length) return null;

	// Include the sender's own device in the fan-out so the sender can
	// decrypt their own messages after a page refresh. Without this slot
	// the in-memory sentPlaintext cache is the only thing keeping our
	// own bubbles readable, and that cache dies with the tab.
	const targetBundles = [...recipientBundles, ...ownBundles].map((b) => ({
		user_id: b.user_id,
		device_id: b.device_id,
		identity_key: b.identity_key,
		registration_id: b.registration_id,
		signed_prekey: b.signed_prekey,
		one_time_prekey: b.one_time_prekey ?? null,
	}));

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
			wrapPlaintext(plaintext, attachments, control),
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

	const senderIdentityKey = recipientBundles[0]
		? '' // we don't surface the local identity key from the manager today;
		: '';
	// Use any of our own bundles to fish out our identity key — they all
	// share the same one because they all originate from the same Olm
	// account. This avoids exposing a separate accessor on the manager.
	const senderBundle = ownBundles.find((b) => b.device_id === ownDeviceId);
	const finalSenderIdentityKey = senderBundle?.identity_key ?? senderIdentityKey;

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

export interface DecryptionResult {
	plaintext: string;
	attachments: Array<EnvelopeAttachmentEntry>;
	verificationStatus: 'verified' | 'changed' | 'unverified';
	control: E2EEControl | null;
}

export const ENCRYPTED_FAILURE_PLACEHOLDER =
	'\u26a0\ufe0f Encrypted message could not be decrypted on this device.';
export const ENCRYPTED_KEY_CHANGED_PREFIX =
	'\u26a0\ufe0f Identity key changed since you last verified — re-verify before trusting this message.';

// Builds the user-visible content string for an incoming or historical
// encrypted message: plaintext on success, a failure placeholder on
// decrypt failure, and a re-verify warning prepended when the sender's
// identity key has rotated since the last verification.
export function buildDecryptedContent(result: DecryptionResult | null): string {
	if (!result) return ENCRYPTED_FAILURE_PLACEHOLDER;
	if (result.verificationStatus === 'changed') {
		return `${ENCRYPTED_KEY_CHANGED_PREFIX}\n\n${result.plaintext}`;
	}
	return result.plaintext;
}

export async function tryDecryptForCurrentDevice(
	currentUserId: string,
	senderUserId: string,
	encryptedPayload: EncryptedPayload | null | undefined,
): Promise<DecryptionResult | null> {
	if (!encryptedPayload) return null;
	if (!E2EEStore.isReady) return null;
	const deviceId = E2EEStore.deviceId;
	if (!deviceId) return null;

	const slot = `${currentUserId}:${deviceId}`;
	const ciphertext = encryptedPayload.ciphertexts[slot];
	if (!ciphertext) return null;

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
		return {
			plaintext: unwrapped.text,
			attachments: unwrapped.attachments,
			verificationStatus,
			control: unwrapped.control,
		};
	} catch (error) {
		logger.warn('Failed to decrypt incoming message', {error});
		return null;
	}
}

// Single entry point used by both the realtime gateway echo path and
// the history fetch path. Layers persistence on top of Olm decrypt so
// successful resolutions (Olm decrypt, sender-own plaintext fallback)
// survive a refresh — Olm sessions are forward-secret and we can't
// re-decrypt the same ciphertext twice in a row, so without this cache
// the first-load decrypt happens but a subsequent reload sees the
// failure placeholder. Returns the same result shape as
// `tryDecryptForCurrentDevice` plus a `cached` flag for diagnostics.
export async function resolveEncryptedMessageContent(
	messageId: string,
	nonce: string | null | undefined,
	currentUserId: string,
	senderUserId: string,
	encryptedPayload: EncryptedPayload | null | undefined,
): Promise<{content: string; result: DecryptionResult | null; cached: boolean}> {
	try {
		const cached = await getCachedMessagePlaintext(messageId);
		if (cached !== null) {
			return {
				content: cached,
				result: {plaintext: cached, attachments: [], verificationStatus: 'unverified', control: null},
				cached: true,
			};
		}
	} catch {
		// IDB read failure shouldn't block decrypt — fall through.
	}

	const result = await tryDecryptForCurrentDevice(currentUserId, senderUserId, encryptedPayload);

	let content = buildDecryptedContent(result);
	let plaintextToPersist: string | null = result ? result.plaintext : null;

	if (!result && senderUserId === currentUserId) {
		const sent = getSentPlaintext(messageId) ?? (nonce ? getSentPlaintext(nonce) : null);
		if (sent !== null) {
			content = sent;
			plaintextToPersist = sent;
		}
	}

	if (plaintextToPersist !== null) {
		void putCachedMessagePlaintext(messageId, plaintextToPersist).catch(() => {});
	}

	return {content, result, cached: false};
}
