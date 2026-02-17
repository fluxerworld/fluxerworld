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
import {createChannelID, createMessageID} from '@fluxer/api/src/BrandedTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {getMessageSearchService} from '@fluxer/api/src/SearchFactory';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	channelId: z.string(),
	lastMessageId: z.string().nullable().optional(),
});

const BATCH_SIZE = 100;

const indexChannelMessages: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);

	const searchService = getMessageSearchService();
	if (!searchService) {
		return;
	}

	const channelId = createChannelID(BigInt(validated.channelId));
	const {channelRepository, userRepository} = getWorkerDependencies();

	try {
		const lastMessageId = validated.lastMessageId ? createMessageID(BigInt(validated.lastMessageId)) : undefined;
		const messages = await channelRepository.listMessages(channelId, lastMessageId, BATCH_SIZE);

		if (messages.length === 0) {
			const channel = await channelRepository.findUnique(channelId);
			if (channel) {
				await channelRepository.upsert({
					...channel.toRow(),
					indexed_at: new Date(),
				});
			}
			return;
		}

		const authorIds = new Set(messages.map((m) => m.authorId).filter((id): id is UserID => id !== null));
		const authorBotMap = new Map<UserID, boolean>();

		for (const authorId of authorIds) {
			const user = await userRepository.findUnique(authorId);
			if (user) {
				authorBotMap.set(authorId, user.isBot);
			}
		}

		await searchService.indexMessages(messages, authorBotMap);

		Logger.debug(
			{
				channelId: channelId.toString(),
				messagesIndexed: messages.length,
				hasMore: messages.length === BATCH_SIZE,
			},
			'Indexed message batch',
		);

		if (messages.length === BATCH_SIZE) {
			const oldestMessageId = messages[messages.length - 1]!.id;
			await helpers.addJob(
				'indexChannelMessages',
				{
					channelId: validated.channelId,
					lastMessageId: oldestMessageId.toString(),
				},
				{
					jobKey: `index-channel-${validated.channelId}-${oldestMessageId}`,
					maxAttempts: 3,
				},
			);
		} else {
			Logger.debug({channelId: channelId.toString()}, 'Channel indexing complete');
			const channel = await channelRepository.findUnique(channelId);
			if (channel) {
				await channelRepository.upsert({
					...channel.toRow(),
					indexed_at: new Date(),
				});
			}
		}
	} catch (error) {
		Logger.error({error, channelId: channelId.toString()}, 'Failed to index channel messages');
		throw error;
	}
};

export default indexChannelMessages;
