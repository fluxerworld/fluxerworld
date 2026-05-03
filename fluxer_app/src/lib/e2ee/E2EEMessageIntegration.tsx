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

// Returns null if the channel isn't E2EE-eligible (not a 1:1 DM, missing
// own keys, recipient lacks any E2EE devices, etc.) so the caller can
// fall through to plaintext send. Group DMs and guild channels are
// deliberately excluded for phase 1 — group sessions need MLS and that's
// a separate slice.
export async function tryEncryptForChannel(
	channel: ChannelRecord,
	currentUserId: string,
	plaintext: string,
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
		encryptedMessages = await e2eeManager.encryptForBundles(targetBundles, plaintext);
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
		const plaintext = await e2eeManager.decrypt(
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
		return {plaintext, verificationStatus};
	} catch (error) {
		logger.warn('Failed to decrypt incoming message', {error});
		return null;
	}
}
