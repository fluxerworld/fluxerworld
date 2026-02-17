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

import {DatabaseSync, type SQLOutputValue, type StatementSync} from 'node:sqlite';
import {DIRECT_S3_EXPIRATION_TABLE} from '@fluxer/constants/src/StorageConstants';

export interface DirectS3ExpirationEntry {
	bucket: string;
	key: string;
	expiresAtMs: number;
}

export class DirectS3ExpirationStore {
	private readonly db: DatabaseSync;
	private readonly upsertStmt: StatementSync;
	private readonly deleteStmt: StatementSync;
	private readonly deleteBucketStmt: StatementSync;
	private readonly getStmt: StatementSync;
	private readonly listAllStmt: StatementSync;

	constructor(dbPath: string) {
		this.db = new DatabaseSync(dbPath);

		this.db.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA synchronous = NORMAL;
			PRAGMA busy_timeout = 5000;

			CREATE TABLE IF NOT EXISTS ${DIRECT_S3_EXPIRATION_TABLE} (
				bucket TEXT NOT NULL,
				key TEXT NOT NULL,
				expires_at INTEGER NOT NULL,
				PRIMARY KEY(bucket, key)
			) WITHOUT ROWID;

			CREATE INDEX IF NOT EXISTS ${DIRECT_S3_EXPIRATION_TABLE}_expires_idx
				ON ${DIRECT_S3_EXPIRATION_TABLE}(expires_at);
		`);

		this.upsertStmt = this.db.prepare(`
			INSERT INTO ${DIRECT_S3_EXPIRATION_TABLE} (bucket, key, expires_at)
			VALUES (?, ?, ?)
			ON CONFLICT(bucket, key) DO UPDATE SET
				expires_at = excluded.expires_at;
		`);

		this.deleteStmt = this.db.prepare(`DELETE FROM ${DIRECT_S3_EXPIRATION_TABLE} WHERE bucket = ? AND key = ?;`);
		this.deleteBucketStmt = this.db.prepare(`DELETE FROM ${DIRECT_S3_EXPIRATION_TABLE} WHERE bucket = ?;`);
		this.getStmt = this.db.prepare(
			`SELECT expires_at FROM ${DIRECT_S3_EXPIRATION_TABLE} WHERE bucket = ? AND key = ?;`,
		);
		this.listAllStmt = this.db.prepare(
			`SELECT bucket, key, expires_at FROM ${DIRECT_S3_EXPIRATION_TABLE} ORDER BY expires_at ASC;`,
		);
	}

	upsert(entry: DirectS3ExpirationEntry): void {
		this.upsertStmt.run(entry.bucket, entry.key, entry.expiresAtMs);
	}

	delete(bucket: string, key: string): void {
		this.deleteStmt.run(bucket, key);
	}

	deleteBucket(bucket: string): void {
		this.deleteBucketStmt.run(bucket);
	}

	getExpiresAtMs(bucket: string, key: string): number | null {
		const row = this.getStmt.get(bucket, key) as Record<string, SQLOutputValue> | undefined;
		if (!row) {
			return null;
		}
		const expiresAt = row['expires_at'];
		if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
			throw new TypeError('Invalid expires_at value in direct S3 expiration store');
		}
		return expiresAt;
	}

	listAll(): Array<DirectS3ExpirationEntry> {
		const rows = this.listAllStmt.all();
		return rows.map((row) => this.parseRow(row));
	}

	private parseRow(row: Record<string, SQLOutputValue>): DirectS3ExpirationEntry {
		const bucket = row['bucket'];
		const key = row['key'];
		const expiresAt = row['expires_at'];

		if (typeof bucket !== 'string' || typeof key !== 'string') {
			throw new TypeError('Invalid bucket or key in direct S3 expiration store');
		}

		if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
			throw new TypeError('Invalid expires_at value in direct S3 expiration store');
		}

		return {bucket, key, expiresAtMs: expiresAt};
	}
}
