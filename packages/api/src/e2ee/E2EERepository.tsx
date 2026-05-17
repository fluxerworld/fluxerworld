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

import type {ChannelID, UserID} from '@fluxer/api/src/BrandedTypes';
import {deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {
	E2EEBackupRow,
	E2EEDeviceRow,
	E2EEGroupSessionBlobRow,
	E2EEOneTimePrekeyRow,
} from '@fluxer/api/src/database/types/E2EETypes';
import {E2EEDevice} from '@fluxer/api/src/models/E2EEDevice';
import {E2EEOneTimePrekey} from '@fluxer/api/src/models/E2EEOneTimePrekey';
import {E2EEBackups, E2EEDevices, E2EEGroupSessionBlobs, E2EEOneTimePrekeys} from '@fluxer/api/src/Tables';

const FETCH_DEVICE_CQL = E2EEDevices.selectCql({
	where: [E2EEDevices.where.eq('user_id'), E2EEDevices.where.eq('device_id')],
});
const FETCH_USER_DEVICES_CQL = E2EEDevices.selectCql({
	where: E2EEDevices.where.eq('user_id'),
});

const FETCH_DEVICE_PREKEYS_CQL = E2EEOneTimePrekeys.selectCql({
	where: [E2EEOneTimePrekeys.where.eq('user_id'), E2EEOneTimePrekeys.where.eq('device_id')],
});

// "Give me all the group-session blobs I haven't picked up for this
// channel yet." Single partition read because the table is partitioned
// by recipient_user_id, so this stays cheap even when the user has
// blobs across many channels.
const FETCH_GROUP_SESSION_BLOBS_FOR_RECIPIENT_IN_CHANNEL_CQL = E2EEGroupSessionBlobs.selectCql({
	where: [E2EEGroupSessionBlobs.where.eq('recipient_user_id'), E2EEGroupSessionBlobs.where.eq('channel_id')],
});

export class E2EERepository {
	async getDevice(userId: UserID, deviceId: string): Promise<E2EEDevice | null> {
		const row = await fetchOne<E2EEDeviceRow>(FETCH_DEVICE_CQL, {user_id: userId, device_id: deviceId});
		return row ? new E2EEDevice(row) : null;
	}

	async listDevices(userId: UserID): Promise<Array<E2EEDevice>> {
		const rows = await fetchMany<E2EEDeviceRow>(FETCH_USER_DEVICES_CQL, {user_id: userId});
		return rows.map((row) => new E2EEDevice(row));
	}

	async upsertDevice(data: E2EEDeviceRow): Promise<E2EEDevice> {
		await upsertOne(E2EEDevices.upsertAll(data));
		return new E2EEDevice(data);
	}

	async deleteDevice(userId: UserID, deviceId: string): Promise<void> {
		await deleteOneOrMany(E2EEDevices.deleteByPk({user_id: userId, device_id: deviceId}));
		await deleteOneOrMany(
			E2EEOneTimePrekeys.delete({
				where: [E2EEOneTimePrekeys.where.eq('user_id'), E2EEOneTimePrekeys.where.eq('device_id')],
			}).bind({
				user_id: userId,
				device_id: deviceId,
			}),
		);
	}

	async deleteAllDevicesForUser(userId: UserID): Promise<void> {
		await deleteOneOrMany(E2EEDevices.delete({where: E2EEDevices.where.eq('user_id')}).bind({user_id: userId}));
		await deleteOneOrMany(
			E2EEOneTimePrekeys.delete({where: E2EEOneTimePrekeys.where.eq('user_id')}).bind({user_id: userId}),
		);
	}

	async listPrekeys(userId: UserID, deviceId: string): Promise<Array<E2EEOneTimePrekey>> {
		const rows = await fetchMany<E2EEOneTimePrekeyRow>(FETCH_DEVICE_PREKEYS_CQL, {
			user_id: userId,
			device_id: deviceId,
		});
		return rows.map((row) => new E2EEOneTimePrekey(row));
	}

	async upsertPrekey(data: E2EEOneTimePrekeyRow): Promise<void> {
		await upsertOne(E2EEOneTimePrekeys.upsertAll(data));
	}

	async deletePrekey(userId: UserID, deviceId: string, keyId: number): Promise<void> {
		await deleteOneOrMany(
			E2EEOneTimePrekeys.deleteByPk({user_id: userId, device_id: deviceId, key_id: keyId}),
		);
	}

	// Best-effort claim: list, pick the first unclaimed, mark as claimed.
	// There's a small race window where two concurrent senders could grab
	// the same key, which would weaken forward secrecy if both successfully
	// completed X3DH. In practice the window is tiny and we treat one-time
	// prekey scarcity as a recoverable error (sender retries with a new
	// claim). Tighter guarantees can be layered on with a Cassandra-style
	// IF clause once the volume justifies it.
	async claimPrekey(userId: UserID, deviceId: string): Promise<E2EEOneTimePrekey | null> {
		const all = await this.listPrekeys(userId, deviceId);
		const candidate = all.find((p) => p.claimedAt === null) ?? null;
		if (!candidate) return null;
		const claimed = new E2EEOneTimePrekey({
			...candidate.toRow(),
			claimed_at: new Date(),
		});
		await upsertOne(E2EEOneTimePrekeys.upsertAll(claimed.toRow()));
		return claimed;
	}

	async countUnclaimedPrekeys(userId: UserID, deviceId: string): Promise<number> {
		const all = await this.listPrekeys(userId, deviceId);
		return all.reduce((acc, p) => acc + (p.claimedAt === null ? 1 : 0), 0);
	}

	async getBackup(userId: UserID): Promise<E2EEBackupRow | null> {
		const row = await fetchOne<E2EEBackupRow>(E2EEBackups.selectCql({where: E2EEBackups.where.eq('user_id')}), {
			user_id: userId,
		});
		return row ?? null;
	}

	async upsertBackup(row: E2EEBackupRow): Promise<void> {
		await upsertOne(E2EEBackups.upsertAll(row));
	}

	async deleteBackup(userId: UserID): Promise<void> {
		await deleteOneOrMany(E2EEBackups.deleteByPk({user_id: userId}));
	}

	// ── Group session blobs (Megolm) ────────────────────────────────────

	async insertGroupSessionBlobs(rows: ReadonlyArray<E2EEGroupSessionBlobRow>): Promise<void> {
		await Promise.all(rows.map((row) => upsertOne(E2EEGroupSessionBlobs.upsertAll(row))));
	}

	async listGroupSessionBlobsForRecipientInChannel(
		recipientUserId: UserID,
		channelId: ChannelID,
	): Promise<Array<E2EEGroupSessionBlobRow>> {
		return await fetchMany<E2EEGroupSessionBlobRow>(FETCH_GROUP_SESSION_BLOBS_FOR_RECIPIENT_IN_CHANNEL_CQL, {
			recipient_user_id: recipientUserId,
			channel_id: channelId,
		});
	}

	async deleteGroupSessionBlob(
		recipientUserId: UserID,
		channelId: ChannelID,
		sessionId: string,
		recipientDeviceId: string,
		senderDeviceId: string,
	): Promise<void> {
		await deleteOneOrMany(
			E2EEGroupSessionBlobs.deleteByPk({
				recipient_user_id: recipientUserId,
				channel_id: channelId,
				session_id: sessionId,
				recipient_device_id: recipientDeviceId,
				sender_device_id: senderDeviceId,
			}),
		);
	}
}
