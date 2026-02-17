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

import {createRoleIDSet, createUserID, type RoleID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {Guild} from '@fluxer/api/src/models/Guild';
import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {User} from '@fluxer/api/src/models/User';
import {GuildVerificationLevel} from '@fluxer/constants/src/GuildConstants';
import {EmailVerificationRequiredError} from '@fluxer/errors/src/domains/auth/EmailVerificationRequiredError';
import {GuildPhoneVerificationRequiredError} from '@fluxer/errors/src/domains/auth/GuildPhoneVerificationRequiredError';
import {AccountTooNewForGuildError} from '@fluxer/errors/src/domains/guild/AccountTooNewForGuildError';
import {GuildVerificationRequiredError} from '@fluxer/errors/src/domains/guild/GuildVerificationRequiredError';
import type {GuildMemberResponse} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';
import {ms} from 'itty-time';

interface VerificationParams {
	user: User;
	ownerId: UserID;
	verificationLevel: number;
	memberJoinedAt?: Date | string | null;
	memberRoles?: Set<RoleID>;
}

function checkGuildVerification(params: VerificationParams): void {
	const {user, ownerId, verificationLevel, memberJoinedAt, memberRoles} = params;

	if (user.id === ownerId) {
		return;
	}

	if (verificationLevel === GuildVerificationLevel.NONE) {
		return;
	}

	if (user.isBot) {
		return;
	}

	if (memberRoles && memberRoles.size > 0) {
		return;
	}

	if (!user.email) {
		throw new GuildVerificationRequiredError('You need to claim your account to send messages in this guild.');
	}

	if (verificationLevel >= GuildVerificationLevel.LOW) {
		if (!user.emailVerified) {
			throw new EmailVerificationRequiredError();
		}
	}

	if (verificationLevel >= GuildVerificationLevel.MEDIUM) {
		const createdAt = snowflakeToDate(BigInt(user.id)).getTime();
		const accountAge = Date.now() - createdAt;
		if (accountAge < ms('5 minutes')) {
			throw new AccountTooNewForGuildError();
		}
	}

	if (verificationLevel >= GuildVerificationLevel.HIGH) {
		if (memberJoinedAt) {
			const joinedAtTime =
				typeof memberJoinedAt === 'string' ? new Date(memberJoinedAt).getTime() : memberJoinedAt.getTime();
			const membershipDuration = Date.now() - joinedAtTime;
			if (membershipDuration < ms('10 minutes')) {
				throw new GuildVerificationRequiredError(
					"You haven't been a member of this guild long enough to send messages.",
				);
			}
		}
	}

	if (verificationLevel >= GuildVerificationLevel.VERY_HIGH) {
		if (!user.phone) {
			throw new GuildPhoneVerificationRequiredError();
		}
	}
}

export function checkGuildVerificationWithGuildModel({
	user,
	guild,
	member,
}: {
	user: User;
	guild: Guild;
	member: GuildMember;
}): void {
	checkGuildVerification({
		user,
		ownerId: guild.ownerId,
		verificationLevel: guild.verificationLevel ?? GuildVerificationLevel.NONE,
		memberJoinedAt: member.joinedAt,
		memberRoles: member.roleIds,
	});
}

export function checkGuildVerificationWithResponse({
	user,
	guild,
	member,
}: {
	user: User;
	guild: GuildResponse;
	member: GuildMemberResponse;
}): void {
	if (!guild.owner_id) {
		throw new Error('Guild owner_id is missing - cannot perform verification');
	}
	const ownerIdBigInt = typeof guild.owner_id === 'bigint' ? guild.owner_id : BigInt(guild.owner_id);

	checkGuildVerification({
		user,
		ownerId: createUserID(ownerIdBigInt),
		verificationLevel: guild.verification_level ?? GuildVerificationLevel.NONE,
		memberJoinedAt: member.joined_at,
		memberRoles: createRoleIDSet(new Set(member.roles.map((roleId) => BigInt(roleId)))),
	});
}
