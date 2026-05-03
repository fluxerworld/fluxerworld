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

	const myEcho = ownBundles.filter((b) => b.device_id !== ownDeviceId);
	const targetBundles = [...recipientBundles, ...myEcho].map((b) => ({
		user_id: b.user_id,
		device_id: b.device_id,
		identity_key: b.identity_key,
		registration_id: b.registration_id,
		signed_prekey: b.signed_prekey,
		one_time_prekey: b.one_time_prekey ?? null,
	}));

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
		return {plaintext: unwrapped.text, attachments: unwrapped.attachments, verificationStatus};
	} catch (error) {
		logger.warn('Failed to decrypt incoming message', {error});
		return null;
	}
}
