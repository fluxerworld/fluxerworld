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

import {createGuildID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	guildId: z.string(),
	userId: z.string(),
	days: z.number().min(0).max(7),
});

const deleteUserMessagesInGuildByTime: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);
	helpers.logger.debug({payload: validated}, 'Processing deleteUserMessagesInGuildByTime task');

	const guildId = createGuildID(BigInt(validated.guildId));
	const userId = createUserID(BigInt(validated.userId));
	const {days} = validated;

	Logger.debug(
		{guildId: guildId.toString(), userId: userId.toString(), days},
		'Starting time-based message deletion for guild ban',
	);

	try {
		const {channelService} = getWorkerDependencies();
		await channelService.deleteUserMessagesInGuild({guildId, userId, days});

		Logger.debug(
			{guildId: guildId.toString(), userId: userId.toString(), days},
			'Time-based message deletion completed successfully',
		);
	} catch (error) {
		Logger.error(
			{guildId: guildId.toString(), userId: userId.toString(), days, error},
			'Failed to delete user messages in guild',
		);
		throw error;
	}
};

export default deleteUserMessagesInGuildByTime;
