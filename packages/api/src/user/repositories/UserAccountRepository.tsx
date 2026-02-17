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
import type {UserRow} from '@fluxer/api/src/database/types/UserTypes';
import type {User} from '@fluxer/api/src/models/User';
import {UserAccountRepository as UserAccountCrudRepository} from '@fluxer/api/src/user/repositories/account/UserAccountRepository';
import {UserDeletionRepository} from '@fluxer/api/src/user/repositories/account/UserDeletionRepository';
import {UserGuildRepository} from '@fluxer/api/src/user/repositories/account/UserGuildRepository';
import {UserLookupRepository} from '@fluxer/api/src/user/repositories/account/UserLookupRepository';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';

export class UserAccountRepository implements IUserAccountRepository {
	private accountRepo: UserAccountCrudRepository;
	private lookupRepo: UserLookupRepository;
	private deletionRepo: UserDeletionRepository;
	private guildRepo: UserGuildRepository;

	constructor() {
		this.accountRepo = new UserAccountCrudRepository();
		this.lookupRepo = new UserLookupRepository(this.accountRepo.findUnique.bind(this.accountRepo));
		this.deletionRepo = new UserDeletionRepository(this.accountRepo.findUnique.bind(this.accountRepo));
		this.guildRepo = new UserGuildRepository();
	}

	async create(data: UserRow): Promise<User> {
		return this.accountRepo.create(data);
	}

	async findUnique(userId: UserID): Promise<User | null> {
		return this.accountRepo.findUnique(userId);
	}

	async findUniqueAssert(userId: UserID): Promise<User> {
		return this.accountRepo.findUniqueAssert(userId);
	}

	async listAllUsersPaginated(limit: number, lastUserId?: UserID): Promise<Array<User>> {
		return this.accountRepo.listAllUsersPaginated(limit, lastUserId);
	}

	async listUsers(userIds: Array<UserID>): Promise<Array<User>> {
		return this.accountRepo.listUsers(userIds);
	}

	async upsert(data: UserRow, oldData?: UserRow | null): Promise<User> {
		return this.accountRepo.upsert(data, oldData);
	}

	async patchUpsert(userId: UserID, patchData: Partial<UserRow>, oldData?: UserRow | null): Promise<User> {
		return this.accountRepo.patchUpsert(userId, patchData, oldData);
	}

	async deleteUserSecondaryIndices(userId: UserID): Promise<void> {
		return this.accountRepo.deleteUserSecondaryIndices(userId);
	}

	async findByEmail(email: string): Promise<User | null> {
		return this.lookupRepo.findByEmail(email);
	}

	async findByPhone(phone: string): Promise<User | null> {
		return this.lookupRepo.findByPhone(phone);
	}

	async findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
		return this.lookupRepo.findByStripeCustomerId(stripeCustomerId);
	}

	async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<User | null> {
		return this.lookupRepo.findByStripeSubscriptionId(stripeSubscriptionId);
	}

	async findByUsernameDiscriminator(username: string, discriminator: number): Promise<User | null> {
		return this.lookupRepo.findByUsernameDiscriminator(username, discriminator);
	}

	async findDiscriminatorsByUsername(username: string): Promise<Set<number>> {
		return this.lookupRepo.findDiscriminatorsByUsername(username);
	}

	async getActivityTracking(userId: UserID): Promise<{last_active_at: Date | null; last_active_ip: string | null}> {
		const result = await this.accountRepo.getActivityTracking(userId);
		return result ?? {last_active_at: null, last_active_ip: null};
	}

	async addPendingDeletion(userId: UserID, pendingDeletionAt: Date, deletionReasonCode: number): Promise<void> {
		return this.deletionRepo.addPendingDeletion(userId, pendingDeletionAt, deletionReasonCode);
	}

	async findUsersPendingDeletion(now: Date): Promise<Array<User>> {
		return this.deletionRepo.findUsersPendingDeletion(now);
	}

	async findUsersPendingDeletionByDate(
		deletionDate: string,
	): Promise<Array<{user_id: bigint; deletion_reason_code: number}>> {
		return this.deletionRepo.findUsersPendingDeletionByDate(deletionDate);
	}

	async isUserPendingDeletion(userId: UserID, deletionDate: string): Promise<boolean> {
		return this.deletionRepo.isUserPendingDeletion(userId, deletionDate);
	}

	async removePendingDeletion(userId: UserID, pendingDeletionAt: Date): Promise<void> {
		return this.deletionRepo.removePendingDeletion(userId, pendingDeletionAt);
	}

	async scheduleDeletion(userId: UserID, pendingDeletionAt: Date, deletionReasonCode: number): Promise<void> {
		return this.deletionRepo.scheduleDeletion(userId, pendingDeletionAt, deletionReasonCode);
	}

	async getUserGuildIds(userId: UserID): Promise<Array<GuildID>> {
		return this.guildRepo.getUserGuildIds(userId);
	}

	async removeFromAllGuilds(userId: UserID): Promise<void> {
		return this.guildRepo.removeFromAllGuilds(userId);
	}

	async updateLastActiveAt(params: {userId: UserID; lastActiveAt: Date; lastActiveIp?: string}): Promise<void> {
		return this.accountRepo.updateLastActiveAt(params);
	}

	async updateSubscriptionStatus(
		userId: UserID,
		updates: {premiumWillCancel: boolean; computedPremiumUntil: Date | null},
	): Promise<{finalVersion: number | null}> {
		return this.accountRepo.updateSubscriptionStatus(userId, updates);
	}
}
