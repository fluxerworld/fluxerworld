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

import type {EnvelopeAttachmentEntry} from '@app/lib/e2ee/E2EEMessageIntegration';

const AES_KEY_BITS = 256;
const IV_BYTES = 12;
const CIPHERTEXT_FILENAME = 'encrypted.bin';
const CIPHERTEXT_MIME = 'application/octet-stream';

function encodeBase64(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin);
}

export interface EncryptedFileResult {
	encryptedFile: File;
	envelopeEntry: EnvelopeAttachmentEntry;
}

export interface EncryptableMetadata {
	width?: number;
	height?: number;
}

// AES-GCM-encrypts the given File and returns both the ciphertext as a
// File suitable for the existing multipart upload path AND the matching
// envelope entry the sender needs to bake into the encrypted payload.
// The returned File is renamed to a generic name + octet-stream mime so
// the server's auto-thumbnailer skips it; original mime/filename are
// preserved in the envelope entry for the receiver to reapply.
export async function encryptFileForUpload(
	file: File,
	metadata: EncryptableMetadata = {},
): Promise<EncryptedFileResult> {
	const rawKey = crypto.getRandomValues(new Uint8Array(AES_KEY_BITS / 8));
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

	const aesKey = await crypto.subtle.importKey(
		'raw',
		rawKey as BufferSource,
		{name: 'AES-GCM'},
		false,
		['encrypt'],
	);

	const plaintext = await file.arrayBuffer();
	const ciphertextBuf = await crypto.subtle.encrypt(
		{name: 'AES-GCM', iv: iv as BufferSource},
		aesKey,
		plaintext,
	);

	const encryptedFile = new File([ciphertextBuf], CIPHERTEXT_FILENAME, {type: CIPHERTEXT_MIME});

	const envelopeEntry: EnvelopeAttachmentEntry = {
		key: encodeBase64(rawKey),
		iv: encodeBase64(iv),
		mime: file.type || 'application/octet-stream',
		name: file.name,
		// Treat 0 as "unknown" — createAttachments initialises width/height
		// to 0 and only overwrites them when getImageDimensions resolves.
		// Persisting 0 here breaks the receiver's `entry.width ?? fallback`
		// (?? only catches null/undefined), so the bubble would render at
		// zero pixels. Drop the field entirely when it's missing.
		...(metadata.width && metadata.width > 0 ? {width: metadata.width} : {}),
		...(metadata.height && metadata.height > 0 ? {height: metadata.height} : {}),
	};

	return {encryptedFile, envelopeEntry};
}

