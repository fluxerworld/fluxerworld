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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {SYSTEM_USER_ID} from '@fluxer/api/src/constants/Core';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {checkGuildVerificationWithGuildModel} from '@fluxer/api/src/utils/GuildVerificationUtils';
import {RelationshipTypes, UserFlags} from '@fluxer/constants/src/UserConstants';
import {CannotSendMessagesToUserError} from '@fluxer/errors/src/domains/channel/CannotSendMessagesToUserError';
import {UnclaimedAccountCannotSendDirectMessagesError} from '@fluxer/errors/src/domains/channel/UnclaimedAccountCannotSendDirectMessagesError';

interface DMPermissionValidatorDeps {
	userRepository: IUserRepository;
	guildRepository: IGuildRepositoryAggregate;
}

export class DMPermissionValidator {
	constructor(private deps: DMPermissionValidatorDeps) {}

	async validate({recipients, userId}: {recipients: Array<User>; userId: UserID}): Promise<void> {
		if (userId === SYSTEM_USER_ID) {
			return;
		}

		const senderUser = await this.deps.userRepository.findUnique(userId);
		if (senderUser?.isUnclaimedAccount()) {
			throw new UnclaimedAccountCannotSendDirectMessagesError();
		}

		const targetUser = recipients.find((recipient) => recipient.id !== userId);
		if (!targetUser) return;

		const senderBlockedTarget = await this.deps.userRepository.getRelationship(
			userId,
			targetUser.id,
			RelationshipTypes.BLOCKED,
		);
		if (senderBlockedTarget) {
			throw new CannotSendMessagesToUserError();
		}

		const targetBlockedSender = await this.deps.userRepository.getRelationship(
			targetUser.id,
			userId,
			RelationshipTypes.BLOCKED,
		);
		if (targetBlockedSender) {
			throw new CannotSendMessagesToUserError();
		}

		const friendship = await this.deps.userRepository.getRelationship(userId, targetUser.id, RelationshipTypes.FRIEND);
		if (friendship) return;

		if (targetUser.flags & UserFlags.APP_STORE_REVIEWER) {
			throw new CannotSendMessagesToUserError();
		}

		const targetSettings = await this.deps.userRepository.findSettings(targetUser.id);
		if (!targetSettings) return;

		const usesBotRestrictions = targetUser.isBot;
		const dmRestrictionsEnabled =
			(usesBotRestrictions ? targetSettings.botDefaultGuildsRestricted : targetSettings.defaultGuildsRestricted) ||
			(usesBotRestrictions ? targetSettings.botRestrictedGuilds.size : targetSettings.restrictedGuilds.size) > 0;
		if (!dmRestrictionsEnabled) {
			return;
		}

		const [userGuilds, targetGuilds] = await Promise.all([
			this.deps.guildRepository.listUserGuilds(userId),
			this.deps.guildRepository.listUserGuilds(targetUser.id),
		]);

		if (!senderUser) {
			throw new CannotSendMessagesToUserError();
		}

		const userGuildIds = new Set(userGuilds.map((guild) => guild.id));
		const mutualGuilds = targetGuilds.filter((guild) => userGuildIds.has(guild.id));

		if (mutualGuilds.length === 0) {
			throw new CannotSendMessagesToUserError();
		}

		const restrictedGuildIds = usesBotRestrictions
			? targetSettings.botRestrictedGuilds
			: targetSettings.restrictedGuilds;

		let hasValidMutualGuild = false;
		for (const guild of mutualGuilds) {
			if (restrictedGuildIds.has(guild.id)) {
				continue;
			}

			const member = await this.deps.guildRepository.getMember(guild.id, userId);
			if (!member) {
				continue;
			}

			try {
				checkGuildVerificationWithGuildModel({user: senderUser, guild, member});
				hasValidMutualGuild = true;
				break;
			} catch {}
		}

		if (!hasValidMutualGuild) {
			throw new CannotSendMessagesToUserError();
		}
	}
}
