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

import {SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

// All key material is exchanged as base64. Curve25519 public keys are 32
// bytes => 44 base64 chars (with padding). Ed25519 signatures used on the
// signed prekey are 64 bytes => 88 base64 chars. We stay loose on the
// length here because the client library can pick how it serialises (raw
// bytes vs. structured prekey bundle) — strict shape validation lives in
// the crypto layer.
const Base64String = z.string().min(1).max(2048);

export const SignedPrekeyPayload = z.object({
	id: z.number().int().min(0),
	public_key: Base64String.describe('Base64-encoded Curve25519 signed prekey public key'),
	signature: Base64String.describe('Base64-encoded Ed25519 signature over the public key by the identity key'),
});
export type SignedPrekeyPayload = z.infer<typeof SignedPrekeyPayload>;

export const OneTimePrekeyPayload = z.object({
	id: z.number().int().min(0),
	public_key: Base64String.describe('Base64-encoded Curve25519 one-time prekey public key'),
});
export type OneTimePrekeyPayload = z.infer<typeof OneTimePrekeyPayload>;

export const RegisterDeviceRequest = z.object({
	device_id: z.string().min(8).max(64).describe('Client-generated stable device identifier (UUID)'),
	device_name: z.string().min(1).max(64).nullish().describe('Human-readable device label shown in account settings'),
	identity_key: Base64String.describe('Base64-encoded Curve25519 long-term identity public key'),
	registration_id: z.number().int().min(0).max(0x7fffffff).describe('Random 31-bit registration ID'),
	signed_prekey: SignedPrekeyPayload,
	one_time_prekeys: z.array(OneTimePrekeyPayload).min(1).max(200),
});
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequest>;

export const RotateSignedPrekeyRequest = z.object({
	signed_prekey: SignedPrekeyPayload,
});
export type RotateSignedPrekeyRequest = z.infer<typeof RotateSignedPrekeyRequest>;

export const TopUpOneTimePrekeysRequest = z.object({
	one_time_prekeys: z.array(OneTimePrekeyPayload).min(1).max(200),
});
export type TopUpOneTimePrekeysRequest = z.infer<typeof TopUpOneTimePrekeysRequest>;

export const E2EEDeviceResponse = z.object({
	user_id: SnowflakeStringType,
	device_id: z.string(),
	device_name: z.string().nullish(),
	identity_key: Base64String,
	registration_id: z.number().int(),
	signed_prekey: SignedPrekeyPayload,
	created_at: z.iso.datetime(),
	last_seen_at: z.iso.datetime(),
	one_time_prekey_count: z.number().int().min(0).describe('Unclaimed one-time prekeys still available for this device'),
});
export type E2EEDeviceResponse = z.infer<typeof E2EEDeviceResponse>;

export const E2EEDeviceListResponse = z.array(E2EEDeviceResponse);
export type E2EEDeviceListResponse = z.infer<typeof E2EEDeviceListResponse>;

// Returned to senders performing X3DH. The one_time_prekey field is null
// when the recipient device has run out of unclaimed one-time prekeys —
// senders should still proceed with just the signed prekey (3DH instead
// of X3DH), which is weaker on forward secrecy for the first message
// but matches Signal's behaviour when the pool is exhausted.
export const E2EEPrekeyBundleResponse = z.object({
	user_id: SnowflakeStringType,
	device_id: z.string(),
	identity_key: Base64String,
	registration_id: z.number().int(),
	signed_prekey: SignedPrekeyPayload,
	one_time_prekey: OneTimePrekeyPayload.nullish(),
});
export type E2EEPrekeyBundleResponse = z.infer<typeof E2EEPrekeyBundleResponse>;

export const E2EEPrekeyBundleListResponse = z.array(E2EEPrekeyBundleResponse);
export type E2EEPrekeyBundleListResponse = z.infer<typeof E2EEPrekeyBundleListResponse>;

// Read-only counterpart to E2EEDeviceResponse used when one user looks up
// another user's published devices for fingerprint verification. Omits
// last_seen_at and the one-time prekey count — those leak metadata about
// the target's activity and aren't needed for verification.
export const E2EEPublicDeviceResponse = z.object({
	user_id: SnowflakeStringType,
	device_id: z.string(),
	device_name: z.string().nullish(),
	identity_key: Base64String,
	registration_id: z.number().int(),
	signed_prekey: SignedPrekeyPayload,
	created_at: z.iso.datetime(),
});
export type E2EEPublicDeviceResponse = z.infer<typeof E2EEPublicDeviceResponse>;

export const E2EEPublicDeviceListResponse = z.array(E2EEPublicDeviceResponse);
export type E2EEPublicDeviceListResponse = z.infer<typeof E2EEPublicDeviceListResponse>;

// The encrypted backup blob that lets a user restore their E2EE state on
// a fresh install. Server stores everything verbatim — only the client
// holds the passphrase that derives the actual encryption key.
export const E2EEBackupBlob = z.object({
	version: z.number().int().min(1),
	algorithm: z.string().min(1).max(64),
	kdf: z.string().min(1).max(64),
	salt: Base64String,
	iterations: z.number().int().min(1).max(10_000_000),
	iv: Base64String,
	ciphertext: z.string().min(1).max(2_000_000),
});
export type E2EEBackupBlob = z.infer<typeof E2EEBackupBlob>;

export const E2EEBackupUploadRequest = E2EEBackupBlob;
export type E2EEBackupUploadRequest = z.infer<typeof E2EEBackupUploadRequest>;

export const E2EEBackupResponse = E2EEBackupBlob.extend({
	created_at: z.iso.datetime(),
	updated_at: z.iso.datetime(),
});
export type E2EEBackupResponse = z.infer<typeof E2EEBackupResponse>;

// ── Group session distribution (Megolm) ─────────────────────────────────
// Sender posts one of these per recipient device, each containing the
// Megolm session key encrypted to that device via Olm. Recipients GET
// their own blobs, decrypt the Olm envelope, then import the resulting
// session_key into an InboundGroupSession.
export const E2EEGroupSessionBlob = z.object({
	recipient_user_id: z.string(),
	recipient_device_id: z.string().min(8).max(64),
	olm_message_type: z.union([z.literal(0), z.literal(1)]),
	olm_ciphertext: z.string().min(1).max(65536),
});
export type E2EEGroupSessionBlob = z.infer<typeof E2EEGroupSessionBlob>;

export const E2EEGroupSessionDistributeRequest = z.object({
	session_id: z.string().min(1).max(128),
	sender_device_id: z.string().min(8).max(64),
	sender_identity_key: z.string().min(1).max(256),
	recipient_blobs: z.array(E2EEGroupSessionBlob).min(1).max(1024),
});
export type E2EEGroupSessionDistributeRequest = z.infer<typeof E2EEGroupSessionDistributeRequest>;

export const E2EEGroupSessionInboundBlob = z.object({
	session_id: z.string(),
	sender_user_id: z.string(),
	sender_device_id: z.string(),
	sender_identity_key: z.string(),
	recipient_device_id: z.string(),
	olm_message_type: z.union([z.literal(0), z.literal(1)]),
	olm_ciphertext: z.string(),
	created_at: z.iso.datetime(),
});
export type E2EEGroupSessionInboundBlob = z.infer<typeof E2EEGroupSessionInboundBlob>;

export const E2EEGroupSessionInboundListResponse = z.array(E2EEGroupSessionInboundBlob);
export type E2EEGroupSessionInboundListResponse = z.infer<typeof E2EEGroupSessionInboundListResponse>;
