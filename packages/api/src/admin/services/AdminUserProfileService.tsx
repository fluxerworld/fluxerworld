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

import {mapUserToAdminResponse} from '@fluxer/api/src/admin/models/UserTypes';
import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import type {AdminUserUpdatePropagator} from '@fluxer/api/src/admin/services/AdminUserUpdatePropagator';
import {createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import {GuildMemberSearchIndexService} from '@fluxer/api/src/guild/services/member/GuildMemberSearchIndexService';
import type {IDiscriminatorService} from '@fluxer/api/src/infrastructure/DiscriminatorService';
import type {EntityAssetService, PreparedAssetUpload} from '@fluxer/api/src/infrastructure/EntityAssetService';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {UserContactChangeLogService} from '@fluxer/api/src/user/services/UserContactChangeLogService';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {TagAlreadyTakenError} from '@fluxer/errors/src/domains/user/TagAlreadyTakenError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {
	ChangeDobRequest,
	ChangeEmailRequest,
	ChangeUsernameRequest,
	ClearUserFieldsRequest,
	SetUserBotStatusRequest,
	SetUserSystemStatusRequest,
	VerifyUserEmailRequest,
} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {types} from 'cassandra-driver';

interface AdminUserProfileServiceDeps {
	userRepository: IUserRepository;
	discriminatorService: IDiscriminatorService;
	entityAssetService: EntityAssetService;
	auditService: AdminAuditService;
	updatePropagator: AdminUserUpdatePropagator;
	contactChangeLogService: UserContactChangeLogService;
	cacheService: ICacheService;
	guildRepository: IGuildRepositoryAggregate;
}

export class AdminUserProfileService {
	private readonly searchIndexService: GuildMemberSearchIndexService;

	constructor(private readonly deps: AdminUserProfileServiceDeps) {
		this.searchIndexService = new GuildMemberSearchIndexService();
	}

	async clearUserFields(data: ClearUserFieldsRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, entityAssetService, auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const updates: Record<string, null | string> = {};
		const preparedAssets: Array<PreparedAssetUpload> = [];

		for (const field of data.fields) {
			if (field === 'avatar') {
				const prepared = await entityAssetService.prepareAssetUpload({
					assetType: 'avatar',
					entityType: 'user',
					entityId: userId,
					previousHash: user.avatarHash,
					base64Image: null,
					errorPath: 'avatar',
				});
				preparedAssets.push(prepared);
				updates['avatar_hash'] = prepared.newHash;
			} else if (field === 'banner') {
				const prepared = await entityAssetService.prepareAssetUpload({
					assetType: 'banner',
					entityType: 'user',
					entityId: userId,
					previousHash: user.bannerHash,
					base64Image: null,
					errorPath: 'banner',
				});
				preparedAssets.push(prepared);
				updates['banner_hash'] = prepared.newHash;
			} else if (field === 'bio') {
				updates['bio'] = null;
			} else if (field === 'pronouns') {
				updates['pronouns'] = null;
			} else if (field === 'global_name') {
				updates['global_name'] = null;
			}
		}

		let updatedUser: User;
		try {
			updatedUser = await userRepository.patchUpsert(userId, updates, user.toRow());
		} catch (error) {
			await Promise.all(preparedAssets.map((p) => entityAssetService.rollbackAssetUpload(p)));
			throw error;
		}

		await Promise.all(preparedAssets.map((p) => entityAssetService.commitAssetChange({prepared: p})));

		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'clear_fields',
			auditLogReason,
			metadata: new Map([['fields', data.fields.join(',')]]),
		});

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}

	async setUserBotStatus(data: SetUserBotStatusRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const updates: Record<string, boolean> = {bot: data.bot};
		if (!data.bot) {
			updates['system'] = false;
		}

		const updatedUser = await userRepository.patchUpsert(userId, updates, user.toRow());
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'set_bot_status',
			auditLogReason,
			metadata: new Map([['bot', data.bot.toString()]]),
		});

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}

	async setUserSystemStatus(data: SetUserSystemStatusRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		if (data.system && !user.isBot) {
			throw InputValidationError.fromCode(
				'system',
				ValidationErrorCodes.USER_MUST_BE_A_BOT_TO_BE_MARKED_AS_A_SYSTEM_USER,
			);
		}

		const updatedUser = await userRepository.patchUpsert(userId, {system: data.system}, user.toRow());
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'set_system_status',
			auditLogReason,
			metadata: new Map([['system', data.system.toString()]]),
		});

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}

	async verifyUserEmail(data: VerifyUserEmailRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const updatedUser = await userRepository.patchUpsert(userId, {email_verified: true}, user.toRow());
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'verify_email',
			auditLogReason,
			metadata: new Map([['email', user.email ?? 'null']]),
		});

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}

	async changeUsername(data: ChangeUsernameRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, discriminatorService, auditService, updatePropagator, contactChangeLogService} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const discriminatorResult = await discriminatorService.generateDiscriminator({
			username: data.username,
			requestedDiscriminator: data.discriminator,
			user,
		});

		if (!discriminatorResult.available || discriminatorResult.discriminator === -1) {
			throw new TagAlreadyTakenError();
		}

		const updatedUser = await userRepository.patchUpsert(
			userId,
			{
				username: data.username,
				discriminator: discriminatorResult.discriminator,
			},
			user.toRow(),
		);
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		await contactChangeLogService.recordDiff({
			oldUser: user,
			newUser: updatedUser,
			reason: 'admin_action',
			actorUserId: adminUserId,
		});

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'change_username',
			auditLogReason,
			metadata: new Map([
				['old_username', user.username],
				['new_username', data.username],
				['discriminator', discriminatorResult.discriminator.toString()],
			]),
		});

		void this.reindexGuildMembersForUser(updatedUser);

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}

	async changeEmail(data: ChangeEmailRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, auditService, updatePropagator, contactChangeLogService} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const updatedUser = await userRepository.patchUpsert(
			userId,
			{
				email: data.email,
				email_verified: false,
			},
			user.toRow(),
		);
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		await contactChangeLogService.recordDiff({
			oldUser: user,
			newUser: updatedUser,
			reason: 'admin_action',
			actorUserId: adminUserId,
		});

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'change_email',
			auditLogReason,
			metadata: new Map([
				['old_email', user.email ?? 'null'],
				['new_email', data.email],
			]),
		});

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}

	private async reindexGuildMembersForUser(updatedUser: User): Promise<void> {
		try {
			const guildIds = await this.deps.userRepository.getUserGuildIds(updatedUser.id);
			for (const guildId of guildIds) {
				const guild = await this.deps.guildRepository.findUnique(guildId);
				if (!guild?.membersIndexedAt) {
					continue;
				}
				const member = await this.deps.guildRepository.getMember(guildId, updatedUser.id);
				if (member) {
					void this.searchIndexService.updateMember(member, updatedUser);
				}
			}
		} catch (error) {
			Logger.error(
				{userId: updatedUser.id.toString(), error},
				'Failed to reindex guild members after admin user update',
			);
		}
	}

	async changeDob(data: ChangeDobRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const updatedUser = await userRepository.patchUpsert(
			userId,
			{
				date_of_birth: types.LocalDate.fromString(data.date_of_birth),
			},
			user.toRow(),
		);
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'change_dob',
			auditLogReason,
			metadata: new Map([
				['old_dob', user.dateOfBirth ?? 'null'],
				['new_dob', data.date_of_birth],
			]),
		});

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}
}
