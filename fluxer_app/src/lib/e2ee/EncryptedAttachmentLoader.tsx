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

import {getAttachmentKey} from '@app/lib/e2ee/E2EEMessageIntegration';
import {Logger} from '@app/lib/Logger';
import {useEffect, useState} from 'react';

const logger = new Logger('EncryptedAttachmentLoader');

function decodeBase64(s: string): Uint8Array {
	const bin = atob(s);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

export type DecryptedAttachmentStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DecryptedAttachmentState {
	status: DecryptedAttachmentStatus;
	blobUrl: string | null;
	mime: string | null;
	error: Error | null;
}

interface UseDecryptedAttachmentParams {
	messageId: string;
	attachmentId: string;
	ciphertextUrl: string;
	enabled?: boolean;
}

// Process-lifetime cache of decrypted blob URLs keyed by message+attachment.
// Components can re-mount (chat virtualization, prop changes) without
// re-fetching or re-decrypting. URLs are revoked when the user logs out
// via revokeAllDecryptedAttachments(); they otherwise stay alive for the
// session, which mirrors how the rest of the chat keeps blob-backed
// content (avatars, attachments, etc.) cached in memory.
const sessionCache = new Map<string, {blobUrl: string; mime: string}>();

function cacheKey(messageId: string, attachmentId: string): string {
	return `${messageId}:${attachmentId}`;
}

export function revokeAllDecryptedAttachments(): void {
	for (const {blobUrl} of sessionCache.values()) {
		URL.revokeObjectURL(blobUrl);
	}
	sessionCache.clear();
}

export function useDecryptedAttachment(params: UseDecryptedAttachmentParams): DecryptedAttachmentState {
	const {messageId, attachmentId, ciphertextUrl, enabled = true} = params;
	const key = cacheKey(messageId, attachmentId);
	const cached = sessionCache.get(key);

	const [state, setState] = useState<DecryptedAttachmentState>(() =>
		cached
			? {status: 'ready', blobUrl: cached.blobUrl, mime: cached.mime, error: null}
			: {status: 'idle', blobUrl: null, mime: null, error: null},
	);

	useEffect(() => {
		if (!enabled) return;
		const hit = sessionCache.get(key);
		if (hit) {
			setState({status: 'ready', blobUrl: hit.blobUrl, mime: hit.mime, error: null});
			return;
		}
		const entry = getAttachmentKey(messageId, attachmentId);
		if (!entry) return; // envelope not decrypted yet — caller will re-render once it is

		let cancelled = false;
		setState({status: 'loading', blobUrl: null, mime: null, error: null});

		void (async () => {
			try {
				const response = await fetch(ciphertextUrl);
				if (!response.ok) throw new Error(`HTTP ${response.status} fetching ciphertext`);
				const ciphertext = await response.arrayBuffer();

				const aesKey = await crypto.subtle.importKey(
					'raw',
					decodeBase64(entry.key) as BufferSource,
					'AES-GCM',
					false,
					['decrypt'],
				);
				const plaintextBuf = await crypto.subtle.decrypt(
					{name: 'AES-GCM', iv: decodeBase64(entry.iv) as BufferSource},
					aesKey,
					ciphertext,
				);

				if (cancelled) return;
				const blob = new Blob([plaintextBuf], {type: entry.mime});
				const blobUrl = URL.createObjectURL(blob);
				sessionCache.set(key, {blobUrl, mime: entry.mime});
				setState({status: 'ready', blobUrl, mime: entry.mime, error: null});
			} catch (error) {
				if (cancelled) return;
				logger.warn('Failed to decrypt attachment', {messageId, attachmentId, error});
				setState({
					status: 'error',
					blobUrl: null,
					mime: null,
					error: error instanceof Error ? error : new Error(String(error)),
				});
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [enabled, messageId, attachmentId, ciphertextUrl, key]);

	return state;
}
