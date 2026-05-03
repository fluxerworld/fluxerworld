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
import type {E2EEOneTimePrekeyRow} from '@fluxer/api/src/database/types/E2EETypes';

export class E2EEOneTimePrekey {
	readonly userId: UserID;
	readonly deviceId: string;
	readonly keyId: number;
	readonly publicKey: string;
	readonly claimedAt: Date | null;

	constructor(row: E2EEOneTimePrekeyRow) {
		this.userId = row.user_id;
		this.deviceId = row.device_id;
		this.keyId = row.key_id;
		this.publicKey = row.public_key;
		this.claimedAt = row.claimed_at ?? null;
	}

	toRow(): E2EEOneTimePrekeyRow {
		return {
			user_id: this.userId,
			device_id: this.deviceId,
			key_id: this.keyId,
			public_key: this.publicKey,
			claimed_at: this.claimedAt,
		};
	}
}
