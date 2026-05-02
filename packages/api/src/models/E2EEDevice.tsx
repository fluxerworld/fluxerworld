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
import type {E2EEDeviceRow} from '@fluxer/api/src/database/types/E2EETypes';

export class E2EEDevice {
	readonly userId: UserID;
	readonly deviceId: string;
	readonly identityKey: string;
	readonly registrationId: number;
	readonly deviceName: string | null;
	readonly signedPrekeyId: number;
	readonly signedPrekeyPublic: string;
	readonly signedPrekeySignature: string;
	readonly signedPrekeyCreatedAt: Date;
	readonly previousSignedPrekeyId: number | null;
	readonly previousSignedPrekeyPublic: string | null;
	readonly previousSignedPrekeySignature: string | null;
	readonly createdAt: Date;
	readonly lastSeenAt: Date;

	constructor(row: E2EEDeviceRow) {
		this.userId = row.user_id;
		this.deviceId = row.device_id;
		this.identityKey = row.identity_key;
		this.registrationId = row.registration_id;
		this.deviceName = row.device_name ?? null;
		this.signedPrekeyId = row.signed_prekey_id;
		this.signedPrekeyPublic = row.signed_prekey_public;
		this.signedPrekeySignature = row.signed_prekey_signature;
		this.signedPrekeyCreatedAt = row.signed_prekey_created_at;
		this.previousSignedPrekeyId = row.previous_signed_prekey_id ?? null;
		this.previousSignedPrekeyPublic = row.previous_signed_prekey_public ?? null;
		this.previousSignedPrekeySignature = row.previous_signed_prekey_signature ?? null;
		this.createdAt = row.created_at;
		this.lastSeenAt = row.last_seen_at;
	}

	toRow(): E2EEDeviceRow {
		return {
			user_id: this.userId,
			device_id: this.deviceId,
			identity_key: this.identityKey,
			registration_id: this.registrationId,
			device_name: this.deviceName,
			signed_prekey_id: this.signedPrekeyId,
			signed_prekey_public: this.signedPrekeyPublic,
			signed_prekey_signature: this.signedPrekeySignature,
			signed_prekey_created_at: this.signedPrekeyCreatedAt,
			previous_signed_prekey_id: this.previousSignedPrekeyId,
			previous_signed_prekey_public: this.previousSignedPrekeyPublic,
			previous_signed_prekey_signature: this.previousSignedPrekeySignature,
			created_at: this.createdAt,
			last_seen_at: this.lastSeenAt,
		};
	}
}
