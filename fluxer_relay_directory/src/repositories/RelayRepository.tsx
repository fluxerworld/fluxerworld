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

import type {DatabaseSync, StatementSync} from 'node:sqlite';

export interface RelayInfo {
	id: string;
	name: string;
	url: string;
	latitude: number;
	longitude: number;
	region: string;
	capacity: number;
	current_connections: number;
	public_key: string;
	registered_at: string;
	last_seen_at: string;
	healthy: boolean;
	failed_checks: number;
}

interface RelayRow {
	id: string;
	name: string;
	url: string;
	latitude: number;
	longitude: number;
	region: string;
	capacity: number;
	current_connections: number;
	public_key: string;
	registered_at: string;
	last_seen_at: string;
	healthy: number;
	failed_checks: number;
}

export interface IRelayRepository {
	getRelay(id: string): RelayInfo | null;
	getAllRelays(): Array<RelayInfo>;
	getHealthyRelays(): Array<RelayInfo>;
	saveRelay(relay: RelayInfo): void;
	updateRelayHealth(id: string, healthy: boolean, failedChecks: number): void;
	updateRelayLastSeen(id: string): void;
	removeRelay(id: string): void;
}

function rowToRelayInfo(row: RelayRow): RelayInfo {
	return {
		...row,
		healthy: row.healthy === 1,
	};
}

export class RelayRepository implements IRelayRepository {
	private readonly db: DatabaseSync;
	private readonly cache: Map<string, RelayInfo>;
	private readonly getRelayStmt: StatementSync;
	private readonly getAllRelaysStmt: StatementSync;
	private readonly insertRelayStmt: StatementSync;
	private readonly updateHealthStmt: StatementSync;
	private readonly updateLastSeenStmt: StatementSync;
	private readonly deleteRelayStmt: StatementSync;

	constructor(db: DatabaseSync) {
		this.db = db;
		this.cache = new Map();

		this.getRelayStmt = this.db.prepare('SELECT * FROM relays WHERE id = ?');
		this.getAllRelaysStmt = this.db.prepare('SELECT * FROM relays');
		this.insertRelayStmt = this.db.prepare(`
			INSERT OR REPLACE INTO relays
			(id, name, url, latitude, longitude, region, capacity, current_connections, public_key, registered_at, last_seen_at, healthy, failed_checks)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);
		this.updateHealthStmt = this.db.prepare('UPDATE relays SET healthy = ?, failed_checks = ? WHERE id = ?');
		this.updateLastSeenStmt = this.db.prepare(
			'UPDATE relays SET last_seen_at = ?, healthy = 1, failed_checks = 0 WHERE id = ?',
		);
		this.deleteRelayStmt = this.db.prepare('DELETE FROM relays WHERE id = ?');

		this.loadCache();
	}

	private loadCache(): void {
		const rows = this.getAllRelaysStmt.all() as unknown as Array<RelayRow>;
		for (const row of rows) {
			this.cache.set(row.id, rowToRelayInfo(row));
		}
	}

	getRelay(id: string): RelayInfo | null {
		const cached = this.cache.get(id);
		if (cached) {
			return cached;
		}

		const row = this.getRelayStmt.get(id) as RelayRow | undefined;
		if (!row) {
			return null;
		}

		const relay = rowToRelayInfo(row);
		this.cache.set(id, relay);
		return relay;
	}

	getAllRelays(): Array<RelayInfo> {
		return Array.from(this.cache.values());
	}

	getHealthyRelays(): Array<RelayInfo> {
		return Array.from(this.cache.values()).filter((relay) => relay.healthy);
	}

	saveRelay(relay: RelayInfo): void {
		this.insertRelayStmt.run(
			relay.id,
			relay.name,
			relay.url,
			relay.latitude,
			relay.longitude,
			relay.region,
			relay.capacity,
			relay.current_connections,
			relay.public_key,
			relay.registered_at,
			relay.last_seen_at,
			relay.healthy ? 1 : 0,
			relay.failed_checks,
		);
		this.cache.set(relay.id, relay);
	}

	updateRelayHealth(id: string, healthy: boolean, failedChecks: number): void {
		this.updateHealthStmt.run(healthy ? 1 : 0, failedChecks, id);
		const cached = this.cache.get(id);
		if (cached) {
			cached.healthy = healthy;
			cached.failed_checks = failedChecks;
		}
	}

	updateRelayLastSeen(id: string): void {
		const now = new Date().toISOString();
		this.updateLastSeenStmt.run(now, id);
		const cached = this.cache.get(id);
		if (cached) {
			cached.last_seen_at = now;
			cached.healthy = true;
			cached.failed_checks = 0;
		}
	}

	removeRelay(id: string): void {
		this.deleteRelayStmt.run(id);
		this.cache.delete(id);
	}
}
