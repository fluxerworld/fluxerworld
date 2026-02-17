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
import type {AuthService} from '@fluxer/api/src/auth/AuthService';
import {createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import type {IEmailService} from '@fluxer/email/src/IEmailService';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {TempBanUserRequest} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';

interface AdminUserBanServiceDeps {
	userRepository: IUserRepository;
	authService: AuthService;
	emailService: IEmailService;
	auditService: AdminAuditService;
	updatePropagator: AdminUserUpdatePropagator;
	cacheService: ICacheService;
}

export class AdminUserBanService {
	constructor(private readonly deps: AdminUserBanServiceDeps) {}

	async tempBanUser(data: TempBanUserRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, authService, emailService, auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const tempBannedUntil = new Date();
		if (data.duration_hours <= 0) {
			// "Permanent" bans are represented as a very long temp ban that requires manual unban.
			// We intentionally skip sending the "temporary suspension" email for this case.
			tempBannedUntil.setFullYear(tempBannedUntil.getFullYear() + 100);
		} else {
			tempBannedUntil.setHours(tempBannedUntil.getHours() + data.duration_hours);
		}

		const updatedUser = await userRepository.patchUpsert(
			userId,
			{
				temp_banned_until: tempBannedUntil,
				flags: user.flags | UserFlags.DISABLED,
			},
			user.toRow(),
		);

		await authService.terminateAllUserSessions(userId);
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		if (user.email && data.duration_hours > 0) {
			await emailService.sendAccountTempBannedEmail(
				user.email,
				user.username,
				data.reason ?? null,
				data.duration_hours,
				tempBannedUntil,
				user.locale,
			);
		}

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'temp_ban',
			auditLogReason,
			metadata: new Map([
				['duration_hours', data.duration_hours.toString()],
				['reason', data.reason ?? 'null'],
				['banned_until', tempBannedUntil.toISOString()],
			]),
		});

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}

	async unbanUser(data: {user_id: bigint}, adminUserId: UserID, auditLogReason: string | null) {
		const {userRepository, emailService, auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const updatedUser = await userRepository.patchUpsert(
			userId,
			{
				temp_banned_until: null,
				flags: user.flags & ~UserFlags.DISABLED,
			},
			user.toRow(),
		);
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});

		if (user.email) {
			await emailService.sendUnbanNotification(
				user.email,
				user.username,
				auditLogReason || 'administrative action',
				user.locale,
			);
		}

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'unban',
			auditLogReason,
			metadata: new Map(),
		});

		return {
			user: await mapUserToAdminResponse(updatedUser, this.deps.cacheService),
		};
	}
}
