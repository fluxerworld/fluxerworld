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

import {ConnectionRecord} from '@app/records/ConnectionRecord';
import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';
import type {ConnectionResponse} from '@fluxer/schema/src/domains/connection/ConnectionSchemas';
import {makeAutoObservable} from 'mobx';

class UserConnectionStore {
	connections: Map<string, ConnectionRecord> = new Map();
	fetched: boolean = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	setConnections(connections: ReadonlyArray<ConnectionResponse>): void {
		this.connections.clear();
		for (const connection of connections) {
			this.connections.set(connection.id, new ConnectionRecord(connection));
		}
		this.fetched = true;
	}

	addConnection(connection: ConnectionResponse): void {
		this.connections.set(connection.id, new ConnectionRecord(connection));
	}

	updateConnection(id: string, data: Partial<ConnectionResponse>): void {
		const existing = this.connections.get(id);
		if (!existing) return;

		const updated = {
			...existing.toJSON(),
			...data,
		};
		this.connections.set(id, new ConnectionRecord(updated));
	}

	removeConnection(id: string): void {
		this.connections.delete(id);
	}

	getConnections(): ReadonlyArray<ConnectionRecord> {
		return Array.from(this.connections.values()).sort((a, b) => a.sortOrder - b.sortOrder);
	}

	getConnection(id: string): ConnectionRecord | undefined {
		return this.connections.get(id);
	}

	hasConnectionByTypeAndName(type: ConnectionType, name: string): boolean {
		const lowerName = name.toLowerCase();
		for (const connection of this.connections.values()) {
			if (connection.type === type && connection.name.toLowerCase() === lowerName) {
				return true;
			}
		}
		return false;
	}

	reset(): void {
		this.connections.clear();
		this.fetched = false;
	}
}

export default new UserConnectionStore();
