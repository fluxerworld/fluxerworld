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
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {Logger} from '@fluxer/api/src/Logger';
import type {Guild} from '@fluxer/api/src/models/Guild';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {BaseUserUpdatePropagator} from '@fluxer/api/src/user/services/BaseUserUpdatePropagator';
import {isManagedTrait} from '@fluxer/constants/src/ManagedTraits';

interface GuildManagedTraitServiceDeps {
	userRepository: IUserRepository;
	guildRepository: IGuildRepositoryAggregate;
	gatewayService: IGatewayService;
	userCacheService: UserCacheService;
}

export class GuildManagedTraitService {
	private readonly updatePropagator: BaseUserUpdatePropagator;

	constructor(private readonly deps: GuildManagedTraitServiceDeps) {
		this.updatePropagator = new BaseUserUpdatePropagator({
			userCacheService: deps.userCacheService,
			gatewayService: deps.gatewayService,
		});
	}

	async ensureTraitsForGuildJoin({guild, user}: {guild: Guild; user: User}): Promise<void> {
		const managedTraits = this.getManagedTraitsFromIterable(guild.features);
		if (managedTraits.size === 0) return;

		const updatedTraits = new Set(user.traits);
		let changed = false;
		for (const trait of managedTraits) {
			if (!updatedTraits.has(trait)) {
				updatedTraits.add(trait);
				changed = true;
			}
		}

		if (!changed) {
			return;
		}

		await this.updateUserTraits(user.id, updatedTraits, user);
	}

	async reconcileTraitsForGuildLeave({guild, userId}: {guild: Guild; userId: UserID}): Promise<void> {
		const managedTraits = this.getManagedTraitsFromIterable(guild.features);
		if (managedTraits.size === 0) return;

		await this.removeTraitsIfNoProviders(userId, managedTraits, guild.id);
	}

	async reconcileTraitsForGuildFeatureChange(params: {
		guildId: GuildID;
		previousFeatures: Iterable<string> | null | undefined;
		newFeatures: Iterable<string> | null | undefined;
	}): Promise<void> {
		const previousTraits = this.getManagedTraitsFromIterable(params.previousFeatures);
		const newTraits = this.getManagedTraitsFromIterable(params.newFeatures);

		const addedTraits = GuildManagedTraitService.difference(newTraits, previousTraits);
		const removedTraits = GuildManagedTraitService.difference(previousTraits, newTraits);

		if (addedTraits.size === 0 && removedTraits.size === 0) {
			return;
		}

		const members = await this.deps.guildRepository.listMembers(params.guildId);

		for (const member of members) {
			try {
				if (addedTraits.size > 0) {
					await this.ensureTraitSetForUser(member.userId, addedTraits);
				}
				if (removedTraits.size > 0) {
					await this.removeTraitsIfNoProviders(member.userId, removedTraits, params.guildId);
				}
			} catch (error) {
				Logger.error(
					{
						guildId: params.guildId.toString(),
						userId: member.userId.toString(),
						error,
					},
					'Failed to reconcile managed traits for guild member',
				);
			}
		}
	}

	private async ensureTraitSetForUser(userId: UserID, traits: Set<string>): Promise<void> {
		const user = await this.deps.userRepository.findUnique(userId);
		if (!user) return;

		const updatedTraits = new Set(user.traits);
		let changed = false;
		for (const trait of traits) {
			if (!updatedTraits.has(trait)) {
				updatedTraits.add(trait);
				changed = true;
			}
		}

		if (!changed) {
			return;
		}

		await this.updateUserTraits(userId, updatedTraits, user);
	}

	private async updateUserTraits(
		userId: UserID,
		traits: Set<string>,
		existingUser?: User | null,
	): Promise<User | null> {
		const user = existingUser ?? (await this.deps.userRepository.findUnique(userId));
		if (!user) {
			return null;
		}

		if (GuildManagedTraitService.areSetsEqual(user.traits, traits)) {
			return null;
		}

		const traitValue = traits.size > 0 ? new Set(traits) : null;
		const updatedUser = await this.deps.userRepository.patchUpsert(userId, {traits: traitValue}, user.toRow());
		await this.updatePropagator.dispatchUserUpdate(updatedUser);
		return updatedUser;
	}

	private async collectManagedTraitsFromGuilds(
		guildIds: Array<GuildID>,
		options?: {excludeGuildId?: GuildID},
	): Promise<Set<string>> {
		const traits = new Set<string>();
		for (const guildId of guildIds) {
			if (options?.excludeGuildId && guildId === options.excludeGuildId) {
				continue;
			}
			const guild = await this.deps.guildRepository.findUnique(guildId);
			if (!guild) continue;
			for (const trait of this.getManagedTraitsFromIterable(guild.features)) {
				traits.add(trait);
			}
		}
		return traits;
	}

	private async removeTraitsIfNoProviders(
		userId: UserID,
		traits: Set<string>,
		excludeGuildId?: GuildID,
	): Promise<void> {
		if (traits.size === 0) {
			return;
		}

		const remainingGuildIds = await this.deps.userRepository.getUserGuildIds(userId);
		const remainingTraits = await this.collectManagedTraitsFromGuilds(remainingGuildIds, {
			excludeGuildId,
		});

		const user = await this.deps.userRepository.findUnique(userId);
		if (!user) return;

		const updatedTraits = new Set(user.traits);
		let changed = false;
		for (const trait of traits) {
			if (updatedTraits.has(trait) && !remainingTraits.has(trait)) {
				updatedTraits.delete(trait);
				changed = true;
			}
		}

		if (!changed) {
			return;
		}

		await this.updateUserTraits(userId, updatedTraits, user);
	}

	private getManagedTraitsFromIterable(features: Iterable<string> | null | undefined): Set<string> {
		const traits = new Set<string>();
		if (!features) {
			return traits;
		}

		for (const feature of features) {
			if (feature && isManagedTrait(feature)) {
				traits.add(feature);
			}
		}

		return traits;
	}

	private static difference(base: Set<string>, comparator: Set<string>): Set<string> {
		const result = new Set<string>();
		for (const entry of base) {
			if (!comparator.has(entry)) {
				result.add(entry);
			}
		}
		return result;
	}

	private static areSetsEqual(a: Set<string>, b: Set<string>): boolean {
		if (a.size !== b.size) {
			return false;
		}
		for (const entry of a) {
			if (!b.has(entry)) {
				return false;
			}
		}
		return true;
	}
}
