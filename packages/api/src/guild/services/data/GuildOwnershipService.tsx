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

import type {GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import {mapGuildToGuildResponse} from '@fluxer/api/src/guild/GuildModel';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {GuildDataHelpers} from '@fluxer/api/src/guild/services/data/GuildDataHelpers';
import type {Guild} from '@fluxer/api/src/models/Guild';
import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {checkGuildVerificationWithGuildModel} from '@fluxer/api/src/utils/GuildVerificationUtils';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {CannotTransferOwnershipToBotError} from '@fluxer/errors/src/domains/guild/CannotTransferOwnershipToBotError';
import {UnknownGuildError} from '@fluxer/errors/src/domains/guild/UnknownGuildError';
import {UnknownGuildMemberError} from '@fluxer/errors/src/domains/guild/UnknownGuildMemberError';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';

export class GuildOwnershipService {
	constructor(
		private readonly guildRepository: IGuildRepositoryAggregate,
		private readonly userRepository: IUserRepository,
		private readonly helpers: GuildDataHelpers,
	) {}

	async transferOwnership(
		params: {userId: UserID; guildId: GuildID; newOwnerId: UserID},
		auditLogReason?: string | null,
	): Promise<GuildResponse> {
		const {userId, guildId, newOwnerId} = params;
		const {guildData} = await this.helpers.getGuildAuthenticated({userId, guildId});

		if (guildData.owner_id !== userId.toString()) {
			throw new MissingPermissionsError();
		}

		const user = await this.userRepository.findUnique(userId);
		if (!user) throw new MissingAccessError();

		const newOwner = await this.guildRepository.getMember(guildId, newOwnerId);
		if (!newOwner) {
			throw new UnknownGuildMemberError();
		}

		const newOwnerUser = await this.userRepository.findUnique(newOwnerId);
		if (newOwnerUser?.isBot) {
			throw new CannotTransferOwnershipToBotError();
		}

		const guild = await this.guildRepository.findUnique(guildId);
		if (!guild) throw new UnknownGuildError();
		const previousSnapshot = this.helpers.serializeGuildForAudit(guild);
		const previousOwnerId = guild.ownerId;

		const updatedGuild = await this.guildRepository.upsert(
			{
				...guild.toRow(),
				owner_id: newOwnerId,
			},
			undefined,
			previousOwnerId,
		);

		await this.helpers.dispatchGuildUpdate(updatedGuild);

		await this.helpers.recordAuditLog({
			guildId,
			userId,
			action: AuditLogActionType.GUILD_UPDATE,
			targetId: guildId,
			auditLogReason: auditLogReason ?? null,
			metadata: {new_owner_id: newOwnerId.toString()},
			changes: this.helpers.computeGuildChanges(previousSnapshot, updatedGuild),
		});
		return mapGuildToGuildResponse(updatedGuild);
	}

	async checkGuildVerification(params: {user: User; guild: Guild; member: GuildMember}): Promise<void> {
		const {user, guild, member} = params;
		checkGuildVerificationWithGuildModel({user, guild, member});
	}
}
