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

import {createChannelID, createGuildID, createMessageID, createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	channelId: z.string(),
	messageId: z.string(),
	authorId: z.string(),
	guildId: z.string().optional(),
	mentionHere: z.boolean().optional(),
});

const handleMentions: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);
	helpers.logger.debug({payload: validated}, 'Processing handleMentions task');

	const {userRepository, channelRepository, readStateService, gatewayService} = getWorkerDependencies();

	const authorId = createUserID(BigInt(validated.authorId));
	const channelId = createChannelID(BigInt(validated.channelId));
	const messageId = createMessageID(BigInt(validated.messageId));
	const guildId = validated.guildId ? createGuildID(BigInt(validated.guildId)) : null;
	const mentionHere = validated.mentionHere ?? false;

	const message = await channelRepository.getMessage(channelId, messageId);
	if (!message) {
		Logger.debug({messageId}, 'handleMentions: Message not found, skipping');
		return;
	}

	const channel = await channelRepository.findUnique(channelId);
	if (!channel) {
		Logger.debug({channelId}, 'handleMentions: Channel not found, skipping');
		return;
	}

	let mentionedUserIds: Array<UserID>;

	if (channel.guildId) {
		const isEveryoneMention = message.mentionEveryone && !mentionHere;
		const roleIds = Array.from(message.mentionedRoleIds);
		const userIds = Array.from(message.mentionedUserIds);

		if (isEveryoneMention || mentionHere) {
			mentionedUserIds = await gatewayService.resolveAllMentions({
				guildId: channel.guildId,
				channelId,
				authorId,
				mentionEveryone: isEveryoneMention,
				mentionHere,
				roleIds,
				userIds,
			});
			Logger.debug(
				{
					channelId,
					guildId: channel.guildId,
					mentionedCount: mentionedUserIds.length,
					everyoneMention: isEveryoneMention,
					hereMention: mentionHere,
					roleCount: message.mentionedRoleIds.size,
					userCount: message.mentionedUserIds.size,
				},
				'Resolved all mentions via combined RPC',
			);
		} else {
			const [roleMentionedUserIds, userMentionedUserIds] = await Promise.all([
				roleIds.length > 0
					? gatewayService.getUsersToMentionByRoles({
							guildId: channel.guildId,
							channelId,
							roleIds,
							authorId,
						})
					: Promise.resolve([]),
				userIds.length > 0
					? gatewayService.getUsersToMentionByUserIds({
							guildId: channel.guildId,
							channelId,
							userIds,
							authorId,
						})
					: Promise.resolve([]),
			]);

			mentionedUserIds = [...roleMentionedUserIds, ...userMentionedUserIds];
			Logger.debug(
				{
					channelId,
					guildId: channel.guildId,
					roleMentionedCount: roleMentionedUserIds.length,
					userMentionedCount: userMentionedUserIds.length,
					roleCount: message.mentionedRoleIds.size,
					userCount: message.mentionedUserIds.size,
				},
				'Resolved role and user mentions via dedicated RPC methods',
			);
		}
	} else {
		mentionedUserIds = Array.from(message.mentionedUserIds).filter((userId) => userId !== authorId);
		Logger.debug({channelId, userMentionCount: mentionedUserIds.length}, 'Handled DM user mentions');
	}

	const uniqueUserIds = Array.from(new Set(mentionedUserIds));
	if (uniqueUserIds.length === 0) {
		Logger.debug({channelId, guildId}, 'No users to mention, skipping read state updates');
		return;
	}

	await readStateService.bulkIncrementMentionCounts(uniqueUserIds.map((userId) => ({userId, channelId})));
	await Promise.all(uniqueUserIds.map((userId) => gatewayService.invalidatePushBadgeCount({userId})));

	if (guildId != null) {
		await userRepository.createRecentMentions(
			uniqueUserIds.map((userId) => ({
				user_id: userId,
				channel_id: channelId,
				message_id: messageId,
				guild_id: guildId,
				is_everyone: message.mentionEveryone,
				is_role: message.mentionedRoleIds.size > 0,
			})),
		);
	}

	Logger.debug(
		{
			channelId,
			guildId,
			totalMentioned: uniqueUserIds.length,
			everyoneMentions: message.mentionEveryone ? 1 : 0,
			roleMentions: message.mentionedRoleIds.size,
			userMentions: message.mentionedUserIds.size,
		},
		'Handled all mentions',
	);
};

export default handleMentions;
