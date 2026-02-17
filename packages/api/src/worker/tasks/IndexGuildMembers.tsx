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
import {createGuildID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import {getGuildMemberSearchService} from '@fluxer/api/src/SearchFactory';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	guildId: z.string(),
	lastUserId: z.string().nullable().optional(),
});

const BATCH_SIZE = 100;

const indexGuildMembers: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);

	const searchService = getGuildMemberSearchService();
	if (!searchService) {
		return;
	}

	const guildId = createGuildID(BigInt(validated.guildId));
	const {guildRepository, userRepository} = getWorkerDependencies();

	try {
		const lastUserId = validated.lastUserId ? createUserID(BigInt(validated.lastUserId)) : undefined;
		const members = await guildRepository.listMembersPaginated(guildId, BATCH_SIZE, lastUserId);

		if (members.length === 0) {
			const guild = await guildRepository.findUnique(guildId);
			if (guild) {
				await guildRepository.upsert({
					...guild.toRow(),
					members_indexed_at: new Date(),
				});
			}
			return;
		}

		const userIds = new Set(members.map((m) => m.userId));
		const userMap = new Map<UserID, User>();

		for (const uid of userIds) {
			const user = await userRepository.findUnique(uid);
			if (user) {
				userMap.set(uid, user);
			}
		}

		const membersWithUsers = members
			.map((member) => {
				const user = userMap.get(member.userId);
				return user ? {member, user} : null;
			})
			.filter((item): item is NonNullable<typeof item> => item != null);

		if (membersWithUsers.length > 0) {
			await searchService.indexMembers(membersWithUsers);
		}

		Logger.debug(
			{
				guildId: guildId.toString(),
				membersIndexed: membersWithUsers.length,
				hasMore: members.length === BATCH_SIZE,
			},
			'Indexed guild member batch',
		);

		if (members.length === BATCH_SIZE) {
			const lastMember = members[members.length - 1]!;
			await helpers.addJob(
				'indexGuildMembers',
				{
					guildId: validated.guildId,
					lastUserId: lastMember.userId.toString(),
				},
				{
					jobKey: `index-guild-members-${validated.guildId}-${lastMember.userId}`,
					maxAttempts: 3,
				},
			);
		} else {
			Logger.debug({guildId: guildId.toString()}, 'Guild member indexing complete');
			const guild = await guildRepository.findUnique(guildId);
			if (guild) {
				await guildRepository.upsert({
					...guild.toRow(),
					members_indexed_at: new Date(),
				});
			}
		}
	} catch (error) {
		Logger.error({error, guildId: guildId.toString()}, 'Failed to index guild members');
		throw error;
	}
};

export default indexGuildMembers;
