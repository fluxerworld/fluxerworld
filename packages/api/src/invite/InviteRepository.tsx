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

import type {ChannelID, GuildID, InviteCode, UserID} from '@fluxer/api/src/BrandedTypes';
import {createInviteCode} from '@fluxer/api/src/BrandedTypes';
import {BatchBuilder, Db, fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {InviteRow} from '@fluxer/api/src/database/types/ChannelTypes';
import {IInviteRepository} from '@fluxer/api/src/invite/IInviteRepository';
import {Invite} from '@fluxer/api/src/models/Invite';
import {Invites, InvitesByChannel, InvitesByGuild} from '@fluxer/api/src/Tables';

const FETCH_INVITE_BY_CODE_CQL = Invites.selectCql({
	where: Invites.where.eq('code'),
	limit: 1,
});

const FETCH_INVITES_BY_CHANNEL_CQL = InvitesByChannel.selectCql({
	columns: ['code'],
	where: InvitesByChannel.where.eq('channel_id'),
});

const FETCH_INVITES_BY_GUILD_CQL = InvitesByGuild.selectCql({
	columns: ['code'],
	where: InvitesByGuild.where.eq('guild_id'),
});

interface CreateInviteParams {
	code: InviteCode;
	type: number;
	guild_id: GuildID;
	channel_id?: ChannelID | null;
	inviter_id?: UserID | null;
	uses: number;
	max_uses: number;
	max_age: number;
	temporary?: boolean;
}

export class InviteRepository extends IInviteRepository {
	async findUnique(code: InviteCode): Promise<Invite | null> {
		const invite = await fetchOne<InviteRow>(FETCH_INVITE_BY_CODE_CQL, {code});
		return invite ? new Invite(invite) : null;
	}

	async listChannelInvites(channelId: ChannelID): Promise<Array<Invite>> {
		const inviteCodes = await fetchMany<{code: string}>(FETCH_INVITES_BY_CHANNEL_CQL, {channel_id: channelId});

		if (inviteCodes.length === 0) return [];

		const invites: Array<Invite> = [];
		for (const {code} of inviteCodes) {
			const invite = await this.findUnique(createInviteCode(code));
			if (invite) invites.push(invite);
		}

		return invites;
	}

	async listGuildInvites(guildId: GuildID): Promise<Array<Invite>> {
		const inviteCodes = await fetchMany<{code: string}>(FETCH_INVITES_BY_GUILD_CQL, {guild_id: guildId});

		if (inviteCodes.length === 0) return [];

		const invites: Array<Invite> = [];
		for (const {code} of inviteCodes) {
			const invite = await this.findUnique(createInviteCode(code));
			if (invite) invites.push(invite);
		}

		return invites;
	}

	async create(data: CreateInviteParams): Promise<Invite> {
		const inviteRow: InviteRow = {
			code: data.code,
			type: data.type,
			guild_id: data.guild_id,
			channel_id: data.channel_id ?? null,
			inviter_id: data.inviter_id ?? null,
			created_at: new Date(),
			uses: data.uses,
			max_uses: data.max_uses,
			max_age: data.max_age,
			temporary: data.temporary ?? false,
			version: 1,
		};

		const batch = new BatchBuilder();

		const hasExpiry = inviteRow.max_age > 0;

		if (hasExpiry) {
			batch.addPrepared(Invites.insertWithTtlParam(inviteRow, 'max_age'));
		} else {
			batch.addPrepared(Invites.insert(inviteRow));
		}

		if (inviteRow.guild_id) {
			batch.addPrepared(
				hasExpiry
					? InvitesByGuild.insertWithTtl(
							{
								guild_id: inviteRow.guild_id,
								code: inviteRow.code,
							},
							inviteRow.max_age,
						)
					: InvitesByGuild.insert({
							guild_id: inviteRow.guild_id,
							code: inviteRow.code,
						}),
			);
		}

		if (inviteRow.channel_id) {
			batch.addPrepared(
				hasExpiry
					? InvitesByChannel.insertWithTtl(
							{
								channel_id: inviteRow.channel_id,
								code: inviteRow.code,
							},
							inviteRow.max_age,
						)
					: InvitesByChannel.insert({
							channel_id: inviteRow.channel_id,
							code: inviteRow.code,
						}),
			);
		}

		await batch.execute();

		await upsertOne(Invites.upsertAll(inviteRow));
		if (inviteRow.guild_id) {
			await upsertOne(
				InvitesByGuild.upsertAll({
					guild_id: inviteRow.guild_id,
					code: inviteRow.code,
				}),
			);
		}
		if (inviteRow.channel_id) {
			await upsertOne(
				InvitesByChannel.upsertAll({
					channel_id: inviteRow.channel_id,
					code: inviteRow.code,
				}),
			);
		}

		return new Invite(inviteRow);
	}

	async updateInviteUses(code: InviteCode, uses: number): Promise<void> {
		await fetchOne(
			Invites.patchByPk(
				{code},
				{
					uses: Db.set(uses),
				},
			),
		);
	}

	async delete(code: InviteCode): Promise<void> {
		const invite = await this.findUnique(code);
		if (!invite) {
			return;
		}

		const batch = new BatchBuilder();
		batch.addPrepared(Invites.deleteByPk({code}));

		if (invite.guildId) {
			batch.addPrepared(InvitesByGuild.deleteByPk({guild_id: invite.guildId, code}));
		}

		if (invite.channelId) {
			batch.addPrepared(InvitesByChannel.deleteByPk({channel_id: invite.channelId, code}));
		}

		await batch.execute();
	}
}
