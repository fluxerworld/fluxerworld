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

import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import {createGuildID, createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {GuildService} from '@fluxer/api/src/guild/services/GuildService';
import {createRequestCache, type RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {JoinSourceTypes} from '@fluxer/constants/src/GuildConstants';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {
	BanGuildMemberRequest,
	BulkAddGuildMembersRequest,
	ForceAddUserToGuildRequest,
	KickGuildMemberRequest,
} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';

interface AdminGuildMembershipServiceDeps {
	userRepository: IUserRepository;
	guildService: GuildService;
	auditService: AdminAuditService;
}

export class AdminGuildMembershipService {
	constructor(private readonly deps: AdminGuildMembershipServiceDeps) {}

	async forceAddUserToGuild({
		data,
		requestCache,
		adminUserId,
		auditLogReason,
	}: {
		data: ForceAddUserToGuildRequest;
		requestCache: RequestCache;
		adminUserId: UserID;
		auditLogReason: string | null;
	}) {
		const {userRepository, guildService, auditService} = this.deps;
		const userId = createUserID(data.user_id);
		const guildId = createGuildID(data.guild_id);

		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		await guildService.addUserToGuild({
			userId,
			guildId,
			sendJoinMessage: true,
			skipBanCheck: true,
			joinSourceType: JoinSourceTypes.ADMIN_FORCE_ADD,
			requestCache,
			initiatorId: adminUserId,
		});

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'force_add_to_guild',
			auditLogReason,
			metadata: new Map([['guild_id', String(guildId)]]),
		});

		return {success: true};
	}

	async bulkAddGuildMembers(data: BulkAddGuildMembersRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {guildService, auditService} = this.deps;
		const successful: Array<string> = [];
		const failed: Array<{id: string; error: string}> = [];
		const guildId = createGuildID(data.guild_id);

		for (const userIdBigInt of data.user_ids) {
			try {
				const userId = createUserID(userIdBigInt);
				await guildService.addUserToGuild({
					userId,
					guildId,
					sendJoinMessage: false,
					skipBanCheck: true,
					joinSourceType: JoinSourceTypes.ADMIN_FORCE_ADD,
					requestCache: createRequestCache(),
					initiatorId: adminUserId,
				});
				successful.push(userId.toString());
			} catch (error) {
				failed.push({
					id: userIdBigInt.toString(),
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'guild',
			targetId: BigInt(guildId),
			action: 'bulk_add_guild_members',
			auditLogReason,
			metadata: new Map([
				['guild_id', guildId.toString()],
				['user_count', data.user_ids.length.toString()],
			]),
		});

		return {
			successful,
			failed,
		};
	}

	async banMember(data: BanGuildMemberRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {guildService, auditService} = this.deps;
		const guildId = createGuildID(data.guild_id);
		const targetId = createUserID(data.user_id);

		await guildService.banMember(
			{
				userId: adminUserId,
				guildId,
				targetId,
				deleteMessageDays: data.delete_message_days,
				reason: data.reason ?? undefined,
				banDurationSeconds: data.ban_duration_seconds ?? undefined,
			},
			auditLogReason,
		);

		const metadata = new Map([
			['guild_id', guildId.toString()],
			['user_id', targetId.toString()],
			['delete_message_days', data.delete_message_days.toString()],
		]);

		if (data.reason) {
			metadata.set('reason', data.reason);
		}

		if (data.ban_duration_seconds != null) {
			metadata.set('ban_duration_seconds', data.ban_duration_seconds.toString());
		}

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'guild_member',
			targetId,
			action: 'ban_member',
			auditLogReason,
			metadata,
		});
	}

	async kickMember(data: KickGuildMemberRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {guildService, auditService} = this.deps;
		const guildId = createGuildID(data.guild_id);
		const targetId = createUserID(data.user_id);

		await guildService.removeMember(
			{
				userId: adminUserId,
				targetId,
				guildId,
			},
			auditLogReason,
		);

		const metadata = new Map([
			['guild_id', guildId.toString()],
			['user_id', targetId.toString()],
		]);

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'guild_member',
			targetId,
			action: 'kick_member',
			auditLogReason,
			metadata,
		});
	}
}
