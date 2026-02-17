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

import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS relays (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	url TEXT NOT NULL UNIQUE,
	latitude REAL NOT NULL,
	longitude REAL NOT NULL,
	region TEXT NOT NULL,
	capacity INTEGER NOT NULL,
	current_connections INTEGER NOT NULL DEFAULT 0,
	public_key TEXT NOT NULL,
	registered_at TEXT NOT NULL,
	last_seen_at TEXT NOT NULL,
	healthy INTEGER NOT NULL DEFAULT 1,
	failed_checks INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_relays_healthy ON relays(healthy);
CREATE INDEX IF NOT EXISTS idx_relays_region ON relays(region);
`;

export function createDatabase(dbPath: string): DatabaseSync {
	const dir = dirname(dbPath);
	mkdirSync(dir, {recursive: true});

	const db = new DatabaseSync(dbPath);
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA synchronous = NORMAL');
	db.exec(SCHEMA);

	return db;
}
