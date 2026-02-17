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

import {applicationIdToUserId, createApplicationID, type GuildID} from '@fluxer/api/src/BrandedTypes';
import {mapGuildMemberToResponse} from '@fluxer/api/src/guild/GuildModel';
import {Logger} from '@fluxer/api/src/Logger';
import {createRequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import {remapAuthorMessagesToDeletedUser} from '@fluxer/api/src/oauth/ApplicationMessageAuthorAnonymization';
import {chunkArray} from '@fluxer/api/src/worker/tasks/utils/MessageDeletion';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {
	DELETED_USER_DISCRIMINATOR,
	DELETED_USER_GLOBAL_NAME,
	DELETED_USER_USERNAME,
	UserFlags,
} from '@fluxer/constants/src/UserConstants';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	applicationId: z.string(),
});

const CHUNK_SIZE = 50;

const applicationProcessDeletion: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);
	helpers.logger.debug({payload: validated}, 'Processing applicationProcessDeletion task');

	const applicationId = createApplicationID(BigInt(validated.applicationId));
	const botUserId = applicationIdToUserId(applicationId);

	const {
		userRepository,
		guildRepository,
		channelRepository,
		applicationRepository,
		userCacheService,
		gatewayService,
		snowflakeService,
	} = getWorkerDependencies();

	Logger.debug({applicationId, botUserId}, 'Starting application deletion');

	try {
		const application = await applicationRepository.getApplication(applicationId);
		if (!application) {
			Logger.warn({applicationId}, 'Application not found, skipping deletion (already deleted)');
			return;
		}

		const botUser = await userRepository.findUniqueAssert(botUserId);
		const replacementAuthorId = await remapAuthorMessagesToDeletedUser({
			originalAuthorId: botUserId,
			channelRepository,
			userRepository,
			snowflakeService,
		});

		if (botUser.flags & UserFlags.DELETED) {
			Logger.info(
				{
					applicationId,
					botUserId,
					replacementAuthorId: replacementAuthorId?.toString() ?? null,
				},
				'Bot user already marked as deleted, skipping profile update',
			);
			await applicationRepository.deleteApplication(applicationId);
			return;
		}

		const updatedBotUser = await userRepository.patchUpsert(
			botUserId,
			{
				username: DELETED_USER_USERNAME,
				global_name: DELETED_USER_GLOBAL_NAME,
				discriminator: DELETED_USER_DISCRIMINATOR,
				flags: botUser.flags | UserFlags.DELETED,
			},
			botUser.toRow(),
		);
		await userCacheService.setUserPartialResponseFromUser(updatedBotUser);

		Logger.debug({applicationId, botUserId}, 'Updated bot user to deleted state');

		const guildIds = await userRepository.getUserGuildIds(botUserId);
		Logger.debug({applicationId, botUserId, guildCount: guildIds.length}, 'Found guilds bot is member of');

		const chunks = chunkArray(guildIds, CHUNK_SIZE);
		let processedGuilds = 0;

		for (const chunk of chunks) {
			await Promise.all(
				chunk.map(async (guildId: GuildID) => {
					try {
						const member = await guildRepository.getMember(guildId, botUserId);
						if (!member) {
							Logger.debug({botUserId, guildId}, 'Member not found in guild, skipping');
							return;
						}

						const requestCache = createRequestCache();
						const botMemberResponse = await mapGuildMemberToResponse(member, userCacheService, requestCache);

						await gatewayService.dispatchGuild({
							guildId,
							event: 'GUILD_MEMBER_UPDATE',
							data: {
								guild_id: guildId.toString(),
								...botMemberResponse,
							},
						});

						Logger.debug({botUserId, guildId}, 'Dispatched GUILD_MEMBER_UPDATE for bot');
					} catch (error) {
						Logger.error({error, botUserId, guildId}, 'Failed to dispatch guild member update');
					}
				}),
			);

			processedGuilds += chunk.length;

			if (processedGuilds < guildIds.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			Logger.info(
				{applicationId, botUserId, processedGuilds, totalGuilds: guildIds.length},
				'Application deletion: dispatched guild updates',
			);
		}

		Logger.debug({applicationId, botUserId, totalGuilds: guildIds.length}, 'Completed guild member updates');

		Logger.debug({applicationId}, 'Deleting application from database');
		await applicationRepository.deleteApplication(applicationId);

		Logger.info({applicationId, botUserId, guildCount: guildIds.length}, 'Application deletion completed successfully');
	} catch (error) {
		Logger.error({error, applicationId, botUserId}, 'Failed to delete application');
		throw error;
	}
};

export default applicationProcessDeletion;
