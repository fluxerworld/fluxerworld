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

import type {UserID} from '@fluxer/api/src/BrandedTypes';

type Nullish<T> = T | null;

// One row per registered device for a user. Each device has its own
// long-term Curve25519 identity key plus a rotating signed prekey.
// The signed prekey is replaced periodically by the client; when it
// rotates, the previous one is kept as previous_signed_prekey_* so
// in-flight session establishments using the old key can still finish.
export interface E2EEDeviceRow {
	user_id: UserID;
	device_id: string;
	identity_key: string;
	registration_id: number;
	device_name: Nullish<string>;
	signed_prekey_id: number;
	signed_prekey_public: string;
	signed_prekey_signature: string;
	signed_prekey_created_at: Date;
	previous_signed_prekey_id: Nullish<number>;
	previous_signed_prekey_public: Nullish<string>;
	previous_signed_prekey_signature: Nullish<string>;
	created_at: Date;
	last_seen_at: Date;
}

export const E2EE_DEVICE_COLUMNS = [
	'user_id',
	'device_id',
	'identity_key',
	'registration_id',
	'device_name',
	'signed_prekey_id',
	'signed_prekey_public',
	'signed_prekey_signature',
	'signed_prekey_created_at',
	'previous_signed_prekey_id',
	'previous_signed_prekey_public',
	'previous_signed_prekey_signature',
	'created_at',
	'last_seen_at',
] as const satisfies ReadonlyArray<keyof E2EEDeviceRow>;

// Pool of one-time Curve25519 prekeys claimed once during X3DH session
// setup. The client uploads a batch (typically 50–100), the server hands
// them out one per claim, and the client tops up when the pool drops.
// claimed_at being non-null means the key has been handed to a sender;
// we keep the row briefly so a slow recipient can still complete the
// session before we GC.
export interface E2EEOneTimePrekeyRow {
	user_id: UserID;
	device_id: string;
	key_id: number;
	public_key: string;
	claimed_at: Nullish<Date>;
}

export const E2EE_ONE_TIME_PREKEY_COLUMNS = [
	'user_id',
	'device_id',
	'key_id',
	'public_key',
	'claimed_at',
] as const satisfies ReadonlyArray<keyof E2EEOneTimePrekeyRow>;

// Opaque encrypted blob holding a user's full E2EE state (pickled
// account + sessions + verifications). The server never sees plaintext.
// Salt and iterations come from the client's passphrase-derivation
// parameters so a recovering install can run the same KDF and get the
// same key. Algorithm is bumped via algorithm/version when we ever
// migrate (e.g. AES-GCM -> XChaCha20-Poly1305).
export interface E2EEBackupRow {
	user_id: UserID;
	version: number;
	algorithm: string;
	kdf: string;
	salt: string;
	iterations: number;
	iv: string;
	ciphertext: string;
	created_at: Date;
	updated_at: Date;
}

export const E2EE_BACKUP_COLUMNS = [
	'user_id',
	'version',
	'algorithm',
	'kdf',
	'salt',
	'iterations',
	'iv',
	'ciphertext',
	'created_at',
	'updated_at',
] as const satisfies ReadonlyArray<keyof E2EEBackupRow>;
