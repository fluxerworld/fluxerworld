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
import {BatchBuilder, Db, fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {AuthSessionRow} from '@fluxer/api/src/database/types/AuthTypes';
import {AuthSession} from '@fluxer/api/src/models/AuthSession';
import {AuthSessions, AuthSessionsByUserId} from '@fluxer/api/src/Tables';

const FETCH_AUTH_SESSIONS_CQL = AuthSessions.selectCql({
	where: AuthSessions.where.in('session_id_hash', 'session_id_hashes'),
});

const FETCH_AUTH_SESSION_BY_TOKEN_CQL = AuthSessions.selectCql({
	where: AuthSessions.where.eq('session_id_hash'),
	limit: 1,
});

const FETCH_AUTH_SESSION_HASHES_BY_USER_ID_CQL = AuthSessionsByUserId.selectCql({
	columns: ['session_id_hash'],
	where: AuthSessionsByUserId.where.eq('user_id'),
});

export class AuthSessionRepository {
	async createAuthSession(sessionData: AuthSessionRow): Promise<AuthSession> {
		const batch = new BatchBuilder();
		batch.addPrepared(AuthSessions.insert(sessionData));
		batch.addPrepared(
			AuthSessionsByUserId.insert({
				user_id: sessionData.user_id,
				session_id_hash: sessionData.session_id_hash,
			}),
		);
		await batch.execute();

		return new AuthSession(sessionData);
	}

	async getAuthSessionByToken(sessionIdHash: Buffer): Promise<AuthSession | null> {
		const session = await fetchOne<AuthSessionRow>(FETCH_AUTH_SESSION_BY_TOKEN_CQL, {session_id_hash: sessionIdHash});
		return session ? new AuthSession(session) : null;
	}

	async listAuthSessions(userId: UserID): Promise<Array<AuthSession>> {
		const sessionHashes = await fetchMany<{session_id_hash: Buffer}>(FETCH_AUTH_SESSION_HASHES_BY_USER_ID_CQL, {
			user_id: userId,
		});
		if (sessionHashes.length === 0) return [];
		const sessions = await fetchMany<AuthSessionRow>(FETCH_AUTH_SESSIONS_CQL, {
			session_id_hashes: sessionHashes.map((s) => s.session_id_hash),
		});
		return sessions.map((session) => new AuthSession(session));
	}

	async updateAuthSessionLastUsed(sessionIdHash: Buffer): Promise<void> {
		await upsertOne(
			AuthSessions.patchByPk(
				{session_id_hash: sessionIdHash},
				{
					approx_last_used_at: Db.set(new Date()),
				},
			),
		);
	}

	async deleteAuthSessions(userId: UserID, sessionIdHashes: Array<Buffer>): Promise<void> {
		const batch = new BatchBuilder();
		for (const sessionIdHash of sessionIdHashes) {
			batch.addPrepared(AuthSessions.deleteByPk({session_id_hash: sessionIdHash}));
			batch.addPrepared(AuthSessionsByUserId.deleteByPk({user_id: userId, session_id_hash: sessionIdHash}));
		}
		await batch.execute();
	}

	async deleteAllAuthSessions(userId: UserID): Promise<void> {
		const sessions = await fetchMany<{session_id_hash: Buffer}>(FETCH_AUTH_SESSION_HASHES_BY_USER_ID_CQL, {
			user_id: userId,
		});

		const batch = new BatchBuilder();
		for (const session of sessions) {
			batch.addPrepared(
				AuthSessions.deleteByPk({
					session_id_hash: session.session_id_hash,
				}),
			);
			batch.addPrepared(
				AuthSessionsByUserId.deleteByPk({
					user_id: userId,
					session_id_hash: session.session_id_hash,
				}),
			);
		}

		if (batch) {
			await batch.execute();
		}
	}
}
