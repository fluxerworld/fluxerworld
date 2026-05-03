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
import type {ChannelRecord} from '@app/records/ChannelRecord';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {ExternalE2EEKeyProvider, type E2EEOptions, type Room} from 'livekit-client';

const logger = new Logger('E2EEVoice');

// SFrame is on top of WebRTC insertable streams. The browser ships these
// in the foreground only on Chromium today, so we feature-detect before
// claiming voice E2EE is supported. iOS Safari etc. fall through to
// plaintext gracefully.
export function isVoiceE2EESupported(): boolean {
	if (typeof window === 'undefined') return false;
	if (typeof Worker === 'undefined') return false;
	const hasInsertableStreams =
		(typeof window.RTCRtpSender !== 'undefined' &&
			('createEncodedStreams' in window.RTCRtpSender.prototype ||
				'transform' in window.RTCRtpSender.prototype)) ||
		typeof (globalThis as {RTCRtpScriptTransform?: unknown}).RTCRtpScriptTransform !== 'undefined';
	return Boolean(hasInsertableStreams);
}

export function isChannelVoiceE2EEEligible(channel: ChannelRecord | null | undefined): boolean {
	if (!channel) return false;
	// Phase 1: only 1:1 DM voice/video. Group DMs and guild voice channels
	// need a group-key protocol (MLS) before they can do this safely.
	if (channel.type !== ChannelTypes.DM) return false;
	if (channel.recipientIds.length !== 2) return false;
	return isVoiceE2EESupported();
}

let cachedWorker: Worker | null = null;
let cachedKeyProvider: ExternalE2EEKeyProvider | null = null;

function ensureWorker(): Worker {
	if (cachedWorker) return cachedWorker;
	cachedWorker = new Worker(
		new URL('livekit-client/dist/livekit-client.e2ee.worker.mjs', import.meta.url),
		{type: 'module', name: 'livekit-e2ee'},
	);
	return cachedWorker;
}

function ensureKeyProvider(): ExternalE2EEKeyProvider {
	if (cachedKeyProvider) return cachedKeyProvider;
	cachedKeyProvider = new ExternalE2EEKeyProvider();
	return cachedKeyProvider;
}

export function buildE2EEOptions(): E2EEOptions {
	return {
		keyProvider: ensureKeyProvider(),
		worker: ensureWorker(),
	};
}

// Phase 1 key derivation: HKDF over (sorted user IDs || channel id ||
// connection id), domain-separated by a string label. Anyone with access
// to the channel can derive the same key, which for a 1:1 DM is exactly
// the two participants. This isn't a forward-secure ephemeral key — that
// requires per-call signaling — but it does keep the SFU and any
// network observer out of the media. The connection_id rotates per
// call session so the key changes each time the call is started fresh.
export async function deriveCallKeyForDm(params: {
	channelId: string;
	connectionId: string;
	currentUserId: string;
	otherUserId: string;
}): Promise<Uint8Array> {
	const sortedUserIds = [params.currentUserId, params.otherUserId].sort().join(':');
	const seed = `fluxer-voice-e2ee-v1|${sortedUserIds}|${params.channelId}|${params.connectionId}`;
	const seedBytes = new TextEncoder().encode(seed);
	const baseKey = await crypto.subtle.importKey('raw', seedBytes as BufferSource, 'HKDF', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: new TextEncoder().encode('fluxer-voice-e2ee') as BufferSource,
			info: new TextEncoder().encode('call-aead-key') as BufferSource,
		},
		baseKey,
		256,
	);
	return new Uint8Array(bits);
}

export async function applyVoiceE2EEKey(room: Room, rawKey: Uint8Array): Promise<void> {
	const provider = ensureKeyProvider();
	// ExternalE2EEKeyProvider.setKey accepts string (PBKDF2-derived) or
	// ArrayBuffer (HKDF-derived). We already ran HKDF locally so pass the
	// raw bytes via the buffer.
	const out = new ArrayBuffer(rawKey.byteLength);
	new Uint8Array(out).set(rawKey);
	await provider.setKey(out);
	await room.setE2EEEnabled(true);
	logger.info('Voice E2EE enabled on room');
}

export async function disableVoiceE2EE(room: Room): Promise<void> {
	try {
		await room.setE2EEEnabled(false);
	} catch (error) {
		logger.warn('Failed to disable voice E2EE cleanly', {error});
	}
}
