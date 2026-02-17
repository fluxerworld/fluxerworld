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
import {
	type CreateConnectionParams,
	IConnectionRepository,
	type UpdateConnectionParams,
} from '@fluxer/api/src/connection/IConnectionRepository';
import {Db, deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {UserConnectionRow} from '@fluxer/api/src/database/types/ConnectionTypes';
import {UserConnections} from '@fluxer/api/src/Tables';
import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';

const FETCH_CONNECTIONS_BY_USER_CQL = UserConnections.selectCql({
	where: UserConnections.where.eq('user_id'),
});

const FETCH_CONNECTION_BY_ID_CQL = UserConnections.selectCql({
	where: [
		UserConnections.where.eq('user_id'),
		UserConnections.where.eq('connection_type'),
		UserConnections.where.eq('connection_id'),
	],
	limit: 1,
});

const COUNT_CONNECTIONS_CQL = UserConnections.selectCountCql({
	where: UserConnections.where.eq('user_id'),
});

export class ConnectionRepository extends IConnectionRepository {
	async findByUserId(userId: UserID): Promise<Array<UserConnectionRow>> {
		return fetchMany<UserConnectionRow>(FETCH_CONNECTIONS_BY_USER_CQL, {user_id: userId});
	}

	async findById(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
	): Promise<UserConnectionRow | null> {
		return fetchOne<UserConnectionRow>(FETCH_CONNECTION_BY_ID_CQL, {
			user_id: userId,
			connection_type: connectionType,
			connection_id: connectionId,
		});
	}

	async findByTypeAndIdentifier(
		userId: UserID,
		connectionType: ConnectionType,
		identifier: string,
	): Promise<UserConnectionRow | null> {
		const connections = await this.findByUserId(userId);
		return (
			connections.find(
				(c) => c.connection_type === connectionType && c.identifier.toLowerCase() === identifier.toLowerCase(),
			) ?? null
		);
	}

	async create(params: CreateConnectionParams): Promise<UserConnectionRow> {
		const now = new Date();
		const row: UserConnectionRow = {
			user_id: params.user_id,
			connection_id: params.connection_id,
			connection_type: params.connection_type,
			identifier: params.identifier,
			name: params.name,
			verified: params.verified ?? false,
			visibility_flags: params.visibility_flags,
			sort_order: params.sort_order,
			verification_token: params.verification_token,
			verified_at: params.verified_at ?? null,
			last_verified_at: params.last_verified_at ?? null,
			created_at: now,
			version: 1,
		};
		await upsertOne(UserConnections.upsertAll(row));
		return row;
	}

	async update(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
		params: UpdateConnectionParams,
	): Promise<void> {
		const patch: Record<string, ReturnType<typeof Db.set>> = {};
		if (params.name !== undefined) {
			patch['name'] = Db.set(params.name);
		}
		if (params.visibility_flags !== undefined) {
			patch['visibility_flags'] = Db.set(params.visibility_flags);
		}
		if (params.sort_order !== undefined) {
			patch['sort_order'] = Db.set(params.sort_order);
		}
		if (params.verified !== undefined) {
			patch['verified'] = Db.set(params.verified);
		}
		if (params.verified_at !== undefined) {
			patch['verified_at'] = Db.set(params.verified_at);
		}
		if (params.last_verified_at !== undefined) {
			patch['last_verified_at'] = Db.set(params.last_verified_at);
		}
		if (Object.keys(patch).length > 0) {
			await upsertOne(
				UserConnections.patchByPk(
					{user_id: userId, connection_type: connectionType, connection_id: connectionId},
					patch,
				),
			);
		}
	}

	async delete(userId: UserID, connectionType: ConnectionType, connectionId: string): Promise<void> {
		await deleteOneOrMany(
			UserConnections.deleteByPk({user_id: userId, connection_type: connectionType, connection_id: connectionId}),
		);
	}

	async count(userId: UserID): Promise<number> {
		const result = await fetchOne<{count: bigint}>(COUNT_CONNECTIONS_CQL, {user_id: userId});
		return result ? Number(result.count) : 0;
	}
}
