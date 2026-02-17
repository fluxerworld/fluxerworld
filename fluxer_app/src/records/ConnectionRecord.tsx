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

import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';
import type {ConnectionResponse} from '@fluxer/schema/src/domains/connection/ConnectionSchemas';

export class ConnectionRecord {
	readonly id: string;
	readonly type: ConnectionType;
	readonly name: string;
	readonly verified: boolean;
	readonly visibilityFlags: number;
	readonly sortOrder: number;

	constructor(connection: ConnectionResponse) {
		this.id = connection.id;
		this.type = connection.type;
		this.name = connection.name;
		this.verified = connection.verified;
		this.visibilityFlags = connection.visibility_flags;
		this.sortOrder = connection.sort_order;
	}

	equals(other: ConnectionRecord): boolean {
		return (
			this.id === other.id &&
			this.type === other.type &&
			this.name === other.name &&
			this.verified === other.verified &&
			this.visibilityFlags === other.visibilityFlags &&
			this.sortOrder === other.sortOrder
		);
	}

	toJSON(): ConnectionResponse {
		return {
			id: this.id,
			type: this.type,
			name: this.name,
			verified: this.verified,
			visibility_flags: this.visibilityFlags,
			sort_order: this.sortOrder,
		};
	}
}
