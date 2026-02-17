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

import {createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {
	BatchBuilder,
	Db,
	deleteOneOrMany,
	executeVersionedUpdate,
	fetchMany,
	fetchOne,
	nextVersion,
} from '@fluxer/api/src/database/Cassandra';
import type {NoteRow, RelationshipRow} from '@fluxer/api/src/database/types/UserTypes';
import {Relationship} from '@fluxer/api/src/models/Relationship';
import {UserNote} from '@fluxer/api/src/models/UserNote';
import {Notes, Relationships, RelationshipsByTarget} from '@fluxer/api/src/Tables';
import type {IUserRelationshipRepository} from '@fluxer/api/src/user/repositories/IUserRelationshipRepository';

const FETCH_ALL_NOTES_CQL = Notes.selectCql({
	where: Notes.where.eq('source_user_id'),
});

const FETCH_NOTE_CQL = Notes.selectCql({
	where: [Notes.where.eq('source_user_id'), Notes.where.eq('target_user_id')],
	limit: 1,
});

const FETCH_RELATIONSHIPS_CQL = Relationships.selectCql({
	where: Relationships.where.eq('source_user_id'),
});

const FETCH_RELATIONSHIP_CQL = Relationships.selectCql({
	where: [
		Relationships.where.eq('source_user_id'),
		Relationships.where.eq('target_user_id'),
		Relationships.where.eq('type'),
	],
	limit: 1,
});

const FETCH_ALL_NOTES_FOR_DELETE_QUERY = Notes.selectCql({
	columns: ['source_user_id', 'target_user_id'],
	limit: 10000,
});

export class UserRelationshipRepository implements IUserRelationshipRepository {
	async clearUserNote(sourceUserId: UserID, targetUserId: UserID): Promise<void> {
		await deleteOneOrMany(
			Notes.deleteByPk({
				source_user_id: sourceUserId,
				target_user_id: targetUserId,
			}),
		);
	}

	async deleteAllNotes(userId: UserID): Promise<void> {
		await deleteOneOrMany(
			Notes.deleteCql({
				where: Notes.where.eq('source_user_id', 'user_id'),
			}),
			{user_id: userId},
		);

		const allNotes = await fetchMany<{source_user_id: bigint; target_user_id: bigint}>(
			FETCH_ALL_NOTES_FOR_DELETE_QUERY,
			{},
		);

		const batch = new BatchBuilder();
		for (const note of allNotes) {
			if (note.target_user_id === BigInt(userId)) {
				batch.addPrepared(
					Notes.deleteByPk({
						source_user_id: createUserID(note.source_user_id),
						target_user_id: createUserID(note.target_user_id),
					}),
				);
			}
		}
		if (batch) {
			await batch.execute();
		}
	}

	async deleteAllRelationships(userId: UserID): Promise<void> {
		const FETCH_RELATIONSHIPS_BY_TARGET_CQL = RelationshipsByTarget.selectCql({
			where: RelationshipsByTarget.where.eq('target_user_id'),
		});

		const relationshipsPointingToUser = await fetchMany<RelationshipRow>(FETCH_RELATIONSHIPS_BY_TARGET_CQL, {
			target_user_id: userId,
		});

		if (relationshipsPointingToUser.length > 0) {
			const batch = new BatchBuilder();
			for (const rel of relationshipsPointingToUser) {
				batch.addPrepared(
					Relationships.deleteByPk({
						source_user_id: rel.source_user_id,
						target_user_id: rel.target_user_id,
						type: rel.type,
					}),
				);
			}
			await batch.execute();
		}

		await deleteOneOrMany(
			RelationshipsByTarget.deleteCql({
				where: RelationshipsByTarget.where.eq('target_user_id', 'user_id'),
			}),
			{user_id: userId},
		);

		await deleteOneOrMany(
			Relationships.deleteCql({
				where: Relationships.where.eq('source_user_id', 'user_id'),
			}),
			{user_id: userId},
		);
	}

	async deleteRelationship(sourceUserId: UserID, targetUserId: UserID, type: number): Promise<void> {
		await Promise.all([
			deleteOneOrMany(
				Relationships.deleteByPk({
					source_user_id: sourceUserId,
					target_user_id: targetUserId,
					type,
				}),
			),
			deleteOneOrMany(
				RelationshipsByTarget.deleteByPk({
					target_user_id: targetUserId,
					source_user_id: sourceUserId,
					type,
				}),
			),
		]);
	}

	async getRelationship(sourceUserId: UserID, targetUserId: UserID, type: number): Promise<Relationship | null> {
		const relationship = await fetchOne<RelationshipRow>(FETCH_RELATIONSHIP_CQL, {
			source_user_id: sourceUserId,
			target_user_id: targetUserId,
			type,
		});
		return relationship ? new Relationship(relationship) : null;
	}

	async getUserNote(sourceUserId: UserID, targetUserId: UserID): Promise<UserNote | null> {
		const note = await fetchOne<NoteRow>(FETCH_NOTE_CQL, {
			source_user_id: sourceUserId,
			target_user_id: targetUserId,
		});
		return note ? new UserNote(note) : null;
	}

	async getUserNotes(sourceUserId: UserID): Promise<Map<UserID, string>> {
		const notes = await fetchMany<NoteRow>(FETCH_ALL_NOTES_CQL, {source_user_id: sourceUserId});
		const noteMap = new Map<UserID, string>();
		for (const note of notes) {
			noteMap.set(note.target_user_id, note.note);
		}
		return noteMap;
	}

	async listRelationships(sourceUserId: UserID): Promise<Array<Relationship>> {
		const relationships = await fetchMany<RelationshipRow>(FETCH_RELATIONSHIPS_CQL, {
			source_user_id: sourceUserId,
		});
		return relationships.map((rel) => new Relationship(rel));
	}

	async hasReachedRelationshipLimit(sourceUserId: UserID, limit: number): Promise<boolean> {
		const relationships = await fetchMany<RelationshipRow>(
			Relationships.selectCql({
				where: Relationships.where.eq('source_user_id'),
				limit: limit + 1,
			}),
			{source_user_id: sourceUserId},
		);
		return relationships.length >= limit;
	}

	async upsertRelationship(relationship: RelationshipRow): Promise<Relationship> {
		const result = await executeVersionedUpdate<RelationshipRow, 'source_user_id' | 'target_user_id' | 'type'>(
			() =>
				fetchOne(FETCH_RELATIONSHIP_CQL, {
					source_user_id: relationship.source_user_id,
					target_user_id: relationship.target_user_id,
					type: relationship.type,
				}),
			(current) => ({
				pk: {
					source_user_id: relationship.source_user_id,
					target_user_id: relationship.target_user_id,
					type: relationship.type,
				},
				patch: {
					nickname: Db.set(relationship.nickname),
					since: Db.set(relationship.since),
					version: Db.set(nextVersion(current?.version)),
				},
			}),
			Relationships,
		);

		const finalRelationship: RelationshipRow = {
			...relationship,
			version: result.finalVersion ?? 1,
		};

		await executeVersionedUpdate<RelationshipRow, 'target_user_id' | 'source_user_id' | 'type'>(
			() =>
				fetchOne(
					RelationshipsByTarget.selectCql({
						where: [
							RelationshipsByTarget.where.eq('target_user_id'),
							RelationshipsByTarget.where.eq('source_user_id'),
							RelationshipsByTarget.where.eq('type'),
						],
						limit: 1,
					}),
					{
						target_user_id: relationship.target_user_id,
						source_user_id: relationship.source_user_id,
						type: relationship.type,
					},
				),
			(current) => ({
				pk: {
					target_user_id: relationship.target_user_id,
					source_user_id: relationship.source_user_id,
					type: relationship.type,
				},
				patch: {
					nickname: Db.set(relationship.nickname),
					since: Db.set(relationship.since),
					version: Db.set(nextVersion(current?.version)),
				},
			}),
			RelationshipsByTarget,
		);

		return new Relationship(finalRelationship);
	}

	async upsertUserNote(sourceUserId: UserID, targetUserId: UserID, note: string): Promise<UserNote> {
		const result = await executeVersionedUpdate<NoteRow, 'source_user_id' | 'target_user_id'>(
			() => fetchOne(FETCH_NOTE_CQL, {source_user_id: sourceUserId, target_user_id: targetUserId}),
			(current) => ({
				pk: {source_user_id: sourceUserId, target_user_id: targetUserId},
				patch: {note: Db.set(note), version: Db.set(nextVersion(current?.version))},
			}),
			Notes,
		);
		return new UserNote({
			source_user_id: sourceUserId,
			target_user_id: targetUserId,
			note,
			version: result.finalVersion ?? 1,
		});
	}

	async backfillRelationshipsIndex(_userId: UserID, relationships: Array<Relationship>): Promise<void> {
		if (relationships.length === 0) {
			return;
		}

		const batch = new BatchBuilder();
		for (const rel of relationships) {
			const row = rel.toRow();
			batch.addPrepared(
				RelationshipsByTarget.upsertAll({
					target_user_id: row.target_user_id,
					source_user_id: row.source_user_id,
					type: row.type,
					nickname: row.nickname,
					since: row.since,
					version: row.version,
				}),
			);
		}
		await batch.execute();
	}
}
