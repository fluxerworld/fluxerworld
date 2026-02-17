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

import {createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import {MessageAnonymizationService} from '@fluxer/api/src/channel/services/message/MessageAnonymizationService';
import {EMPTY_USER_ROW} from '@fluxer/api/src/database/types/UserTypes';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {Logger} from '@fluxer/api/src/Logger';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {
	DELETED_USER_DISCRIMINATOR,
	DELETED_USER_GLOBAL_NAME,
	DELETED_USER_USERNAME,
	UserFlags,
} from '@fluxer/constants/src/UserConstants';

interface RemapAuthorMessagesToDeletedUserParams {
	originalAuthorId: UserID;
	channelRepository: IChannelRepository;
	userRepository: IUserRepository;
	snowflakeService: SnowflakeService;
}

async function createDeletedMessageAuthorUser(params: {
	userRepository: IUserRepository;
	snowflakeService: SnowflakeService;
}): Promise<UserID> {
	const deletedUserId = createUserID(await params.snowflakeService.generate());

	await params.userRepository.create({
		...EMPTY_USER_ROW,
		user_id: deletedUserId,
		username: DELETED_USER_USERNAME,
		discriminator: DELETED_USER_DISCRIMINATOR,
		global_name: DELETED_USER_GLOBAL_NAME,
		bot: false,
		system: true,
		flags: UserFlags.DELETED,
	});
	await params.userRepository.deleteUserSecondaryIndices(deletedUserId);

	return deletedUserId;
}

export async function remapAuthorMessagesToDeletedUser(
	params: RemapAuthorMessagesToDeletedUserParams,
): Promise<UserID | null> {
	const {originalAuthorId, channelRepository, userRepository, snowflakeService} = params;
	const hasMessages = await channelRepository.listMessagesByAuthor(originalAuthorId, 1);
	if (hasMessages.length === 0) {
		return null;
	}

	const replacementAuthorId = await createDeletedMessageAuthorUser({
		userRepository,
		snowflakeService,
	});

	const anonymizationService = new MessageAnonymizationService(channelRepository);
	await anonymizationService.anonymizeMessagesByAuthor(originalAuthorId, replacementAuthorId);
	Logger.info(
		{originalAuthorId: originalAuthorId.toString(), replacementAuthorId: replacementAuthorId.toString()},
		'Remapped authored messages to deleted user id',
	);
	return replacementAuthorId;
}
