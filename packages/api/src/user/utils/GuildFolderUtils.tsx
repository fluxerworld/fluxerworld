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
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {mapUserSettingsToResponse} from '@fluxer/api/src/user/UserMappers';
import {UNCATEGORIZED_FOLDER_ID} from '@fluxer/constants/src/UserConstants';

export async function removeGuildFromUserFolders(params: {
	userId: UserID;
	guildId: GuildID;
	userRepository: IUserRepository;
	gatewayService: IGatewayService;
}): Promise<void> {
	const {userId, guildId, userRepository, gatewayService} = params;
	const userSettings = await userRepository.findSettings(userId);
	if (!userSettings) return;

	const settingsRow = userSettings.toRow();
	const existingFolders = settingsRow.guild_folders ?? [];

	let modified = false;
	const updatedFolders = existingFolders
		.map((folder) => {
			const currentGuildIds = folder.guild_ids ?? [];
			const filteredGuildIds = currentGuildIds.filter((id) => id !== guildId);
			if (filteredGuildIds.length !== currentGuildIds.length) {
				modified = true;
			}
			return {
				...folder,
				guild_ids: filteredGuildIds.length > 0 ? filteredGuildIds : null,
			};
		})
		.filter((folder) => {
			const guildIds = folder.guild_ids ?? [];
			return folder.folder_id === UNCATEGORIZED_FOLDER_ID || guildIds.length > 0;
		});

	if (modified) {
		settingsRow.guild_folders = updatedFolders;
		const updatedSettings = await userRepository.upsertSettings(settingsRow);
		const guildIds = await userRepository.getUserGuildIds(userId);
		await gatewayService.dispatchPresence({
			userId,
			event: 'USER_SETTINGS_UPDATE',
			data: mapUserSettingsToResponse({settings: updatedSettings, memberGuildIds: guildIds}),
		});
	}
}
