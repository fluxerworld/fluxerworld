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
import type {E2EERepository} from '@fluxer/api/src/e2ee/E2EERepository';
import type {E2EEDevice} from '@fluxer/api/src/models/E2EEDevice';
import type {
	E2EEBackupResponse,
	E2EEBackupUploadRequest,
	E2EEDeviceResponse,
	E2EEPrekeyBundleResponse,
	E2EEPublicDeviceResponse,
	OneTimePrekeyPayload,
	RegisterDeviceRequest,
	RotateSignedPrekeyRequest,
	TopUpOneTimePrekeysRequest,
} from '@fluxer/schema/src/domains/e2ee/E2EESchemas';

function mapDeviceToResponse(device: E2EEDevice, oneTimePrekeyCount: number): E2EEDeviceResponse {
	return {
		user_id: device.userId.toString(),
		device_id: device.deviceId,
		device_name: device.deviceName,
		identity_key: device.identityKey,
		registration_id: device.registrationId,
		signed_prekey: {
			id: device.signedPrekeyId,
			public_key: device.signedPrekeyPublic,
			signature: device.signedPrekeySignature,
		},
		created_at: device.createdAt.toISOString(),
		last_seen_at: device.lastSeenAt.toISOString(),
		one_time_prekey_count: oneTimePrekeyCount,
	};
}

export class E2EEService {
	constructor(private readonly repository: E2EERepository) {}

	async listOwnDevices(userId: UserID): Promise<Array<E2EEDeviceResponse>> {
		const devices = await this.repository.listDevices(userId);
		return Promise.all(
			devices.map(async (device) => {
				const count = await this.repository.countUnclaimedPrekeys(userId, device.deviceId);
				return mapDeviceToResponse(device, count);
			}),
		);
	}

	async registerDevice(userId: UserID, body: RegisterDeviceRequest): Promise<E2EEDeviceResponse> {
		const now = new Date();
		const device = await this.repository.upsertDevice({
			user_id: userId,
			device_id: body.device_id,
			identity_key: body.identity_key,
			registration_id: body.registration_id,
			device_name: body.device_name ?? null,
			signed_prekey_id: body.signed_prekey.id,
			signed_prekey_public: body.signed_prekey.public_key,
			signed_prekey_signature: body.signed_prekey.signature,
			signed_prekey_created_at: now,
			previous_signed_prekey_id: null,
			previous_signed_prekey_public: null,
			previous_signed_prekey_signature: null,
			created_at: now,
			last_seen_at: now,
		});

		await Promise.all(body.one_time_prekeys.map((p) => this.upsertOneTimePrekey(userId, body.device_id, p)));

		const count = await this.repository.countUnclaimedPrekeys(userId, body.device_id);
		return mapDeviceToResponse(device, count);
	}

	async rotateSignedPrekey(
		userId: UserID,
		deviceId: string,
		body: RotateSignedPrekeyRequest,
	): Promise<E2EEDeviceResponse | null> {
		const existing = await this.repository.getDevice(userId, deviceId);
		if (!existing) return null;

		const now = new Date();
		const updated = await this.repository.upsertDevice({
			...existing.toRow(),
			previous_signed_prekey_id: existing.signedPrekeyId,
			previous_signed_prekey_public: existing.signedPrekeyPublic,
			previous_signed_prekey_signature: existing.signedPrekeySignature,
			signed_prekey_id: body.signed_prekey.id,
			signed_prekey_public: body.signed_prekey.public_key,
			signed_prekey_signature: body.signed_prekey.signature,
			signed_prekey_created_at: now,
			last_seen_at: now,
		});
		const count = await this.repository.countUnclaimedPrekeys(userId, deviceId);
		return mapDeviceToResponse(updated, count);
	}

	async topUpOneTimePrekeys(
		userId: UserID,
		deviceId: string,
		body: TopUpOneTimePrekeysRequest,
	): Promise<{added: number; total_unclaimed: number} | null> {
		const existing = await this.repository.getDevice(userId, deviceId);
		if (!existing) return null;

		await Promise.all(body.one_time_prekeys.map((p) => this.upsertOneTimePrekey(userId, deviceId, p)));
		await this.repository.upsertDevice({
			...existing.toRow(),
			last_seen_at: new Date(),
		});

		const totalUnclaimed = await this.repository.countUnclaimedPrekeys(userId, deviceId);
		return {added: body.one_time_prekeys.length, total_unclaimed: totalUnclaimed};
	}

	async deleteOwnDevice(userId: UserID, deviceId: string): Promise<boolean> {
		const existing = await this.repository.getDevice(userId, deviceId);
		if (!existing) return false;
		await this.repository.deleteDevice(userId, deviceId);
		return true;
	}

	async listPublicDevicesForUser(targetUserId: UserID): Promise<Array<E2EEPublicDeviceResponse>> {
		const devices = await this.repository.listDevices(targetUserId);
		return devices.map((device) => ({
			user_id: device.userId.toString(),
			device_id: device.deviceId,
			device_name: device.deviceName,
			identity_key: device.identityKey,
			registration_id: device.registrationId,
			signed_prekey: {
				id: device.signedPrekeyId,
				public_key: device.signedPrekeyPublic,
				signature: device.signedPrekeySignature,
			},
			created_at: device.createdAt.toISOString(),
		}));
	}

	async claimPrekeyBundlesForUser(targetUserId: UserID): Promise<Array<E2EEPrekeyBundleResponse>> {
		const devices = await this.repository.listDevices(targetUserId);
		const bundles: Array<E2EEPrekeyBundleResponse> = [];
		for (const device of devices) {
			const claimed = await this.repository.claimPrekey(targetUserId, device.deviceId);
			bundles.push({
				user_id: targetUserId.toString(),
				device_id: device.deviceId,
				identity_key: device.identityKey,
				registration_id: device.registrationId,
				signed_prekey: {
					id: device.signedPrekeyId,
					public_key: device.signedPrekeyPublic,
					signature: device.signedPrekeySignature,
				},
				one_time_prekey: claimed
					? {id: claimed.keyId, public_key: claimed.publicKey}
					: null,
			});
		}
		return bundles;
	}

	private async upsertOneTimePrekey(userId: UserID, deviceId: string, payload: OneTimePrekeyPayload): Promise<void> {
		await this.repository.upsertPrekey({
			user_id: userId,
			device_id: deviceId,
			key_id: payload.id,
			public_key: payload.public_key,
			claimed_at: null,
		});
	}

	async getBackup(userId: UserID): Promise<E2EEBackupResponse | null> {
		const row = await this.repository.getBackup(userId);
		if (!row) return null;
		return {
			version: row.version,
			algorithm: row.algorithm,
			kdf: row.kdf,
			salt: row.salt,
			iterations: row.iterations,
			iv: row.iv,
			ciphertext: row.ciphertext,
			created_at: row.created_at.toISOString(),
			updated_at: row.updated_at.toISOString(),
		};
	}

	async uploadBackup(userId: UserID, body: E2EEBackupUploadRequest): Promise<E2EEBackupResponse> {
		const existing = await this.repository.getBackup(userId);
		const now = new Date();
		const row = {
			user_id: userId,
			version: body.version,
			algorithm: body.algorithm,
			kdf: body.kdf,
			salt: body.salt,
			iterations: body.iterations,
			iv: body.iv,
			ciphertext: body.ciphertext,
			created_at: existing?.created_at ?? now,
			updated_at: now,
		};
		await this.repository.upsertBackup(row);
		return {
			version: row.version,
			algorithm: row.algorithm,
			kdf: row.kdf,
			salt: row.salt,
			iterations: row.iterations,
			iv: row.iv,
			ciphertext: row.ciphertext,
			created_at: row.created_at.toISOString(),
			updated_at: row.updated_at.toISOString(),
		};
	}

	async deleteBackup(userId: UserID): Promise<void> {
		await this.repository.deleteBackup(userId);
	}
}
