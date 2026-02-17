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
import type {UserConnectionRow} from '@fluxer/api/src/database/types/ConnectionTypes';
import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';

export interface CreateConnectionParams {
	user_id: UserID;
	connection_id: string;
	connection_type: ConnectionType;
	identifier: string;
	name: string;
	visibility_flags: number;
	sort_order: number;
	verification_token: string;
	verified?: boolean;
	verified_at?: Date | null;
	last_verified_at?: Date | null;
}

export interface UpdateConnectionParams {
	name?: string;
	visibility_flags?: number;
	sort_order?: number;
	verified?: boolean;
	verified_at?: Date | null;
	last_verified_at?: Date | null;
}

export abstract class IConnectionRepository {
	abstract findByUserId(userId: UserID): Promise<Array<UserConnectionRow>>;
	abstract findById(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
	): Promise<UserConnectionRow | null>;
	abstract findByTypeAndIdentifier(
		userId: UserID,
		connectionType: ConnectionType,
		identifier: string,
	): Promise<UserConnectionRow | null>;
	abstract create(params: CreateConnectionParams): Promise<UserConnectionRow>;
	abstract update(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
		params: UpdateConnectionParams,
	): Promise<void>;
	abstract delete(userId: UserID, connectionType: ConnectionType, connectionId: string): Promise<void>;
	abstract count(userId: UserID): Promise<number>;
}
