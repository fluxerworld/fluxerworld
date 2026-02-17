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

import type {GuildID, RoleID, UserID} from '@fluxer/api/src/BrandedTypes';
import {guildIdToRoleId} from '@fluxer/api/src/BrandedTypes';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {BannedFromGuildError} from '@fluxer/errors/src/domains/guild/BannedFromGuildError';
import {IpBannedFromGuildError} from '@fluxer/errors/src/domains/guild/IpBannedFromGuildError';
import {UnknownGuildRoleError} from '@fluxer/errors/src/domains/guild/UnknownGuildRoleError';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';

function ensureNotEveryoneRole(roleId: RoleID, guildId: GuildID, path: string): void {
	if (roleId === guildIdToRoleId(guildId)) {
		throw InputValidationError.fromCode(path, ValidationErrorCodes.INVALID_ROLE_ID);
	}
}

export class GuildMemberValidationService {
	constructor(
		private readonly guildRepository: IGuildRepositoryAggregate,
		private readonly userRepository: IUserRepository,
	) {}

	async validateAndGetRoleIds(params: {
		userId: UserID;
		guildId: GuildID;
		guildData: GuildResponse;
		targetId: UserID;
		targetMember: GuildMember;
		newRoles: Array<RoleID>;
		hasPermission: (permission: bigint) => Promise<boolean>;
		canManageRoles: (targetUserId: UserID, targetRoleId: RoleID) => Promise<boolean>;
	}): Promise<Array<RoleID>> {
		const {userId, guildId, guildData, targetId, targetMember, newRoles, hasPermission, canManageRoles} = params;

		for (const roleId of newRoles) {
			ensureNotEveryoneRole(roleId, guildId, 'roles');
		}

		if (guildData && guildData.owner_id === userId.toString()) {
			const existingRoles = await this.guildRepository.listRolesByIds(newRoles, guildId);
			if (existingRoles.length !== newRoles.length) {
				throw new UnknownGuildRoleError();
			}
			return newRoles;
		}

		if (!(await hasPermission(Permissions.MANAGE_ROLES))) {
			throw new MissingPermissionsError();
		}

		const currentRoles = targetMember.roleIds;
		const rolesToRemove = [...currentRoles].filter((roleId) => !newRoles.includes(roleId));
		const rolesToAdd = newRoles.filter((roleId) => !currentRoles.has(roleId));

		for (const roleId of [...rolesToAdd, ...rolesToRemove]) {
			if (roleId === guildIdToRoleId(guildId)) continue;
			if (!(await canManageRoles(targetId, roleId))) {
				throw new MissingPermissionsError();
			}
		}

		const existingRoles = await this.guildRepository.listRolesByIds(newRoles, guildId);
		if (existingRoles.length !== newRoles.length) {
			throw new UnknownGuildRoleError();
		}

		return newRoles;
	}

	async validateRoleAssignment(params: {
		guildData: GuildResponse;
		guildId: GuildID;
		userId: UserID;
		targetId: UserID;
		roleId: RoleID;
		canManageRoles: (targetUserId: UserID, targetRoleId: RoleID) => Promise<boolean>;
	}): Promise<void> {
		const {guildData, guildId, userId, targetId, roleId, canManageRoles} = params;

		ensureNotEveryoneRole(roleId, guildId, 'role_id');

		if (guildData && guildData.owner_id === userId.toString()) {
			const role = await this.guildRepository.getRole(roleId, guildId);
			if (!role || role.id === guildIdToRoleId(guildId)) {
				throw new UnknownGuildRoleError();
			}
		} else {
			if (!(await canManageRoles(targetId, roleId))) {
				throw new MissingPermissionsError();
			}
		}
	}

	async checkUserBanStatus({userId, guildId}: {userId: UserID; guildId: GuildID}): Promise<void> {
		const bans = await this.guildRepository.listBans(guildId);
		const user = await this.userRepository.findUnique(userId);
		const userIp = user?.lastActiveIp;

		for (const ban of bans) {
			if (ban.userId === userId) {
				throw new BannedFromGuildError();
			}
			if (userIp && ban.ipAddress && ban.ipAddress === userIp) {
				throw new IpBannedFromGuildError();
			}
		}
	}
}
