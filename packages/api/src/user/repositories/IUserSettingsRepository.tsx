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
import type {ExactRow} from '@fluxer/api/src/database/types/DatabaseRowTypes';
import type {UserGuildSettingsRow, UserSettingsRow} from '@fluxer/api/src/database/types/UserTypes';
import type {UserGuildSettings} from '@fluxer/api/src/models/UserGuildSettings';
import type {UserSettings} from '@fluxer/api/src/models/UserSettings';

export interface IUserSettingsRepository {
	findSettings(userId: UserID): Promise<UserSettings | null>;
	upsertSettings(settings: ExactRow<UserSettingsRow>): Promise<UserSettings>;
	deleteUserSettings(userId: UserID): Promise<void>;

	findGuildSettings(userId: UserID, guildId: GuildID | null): Promise<UserGuildSettings | null>;
	findAllGuildSettings(userId: UserID): Promise<Array<UserGuildSettings>>;
	upsertGuildSettings(settings: ExactRow<UserGuildSettingsRow>): Promise<UserGuildSettings>;
	deleteGuildSettings(userId: UserID, guildId: GuildID): Promise<void>;
	deleteAllUserGuildSettings(userId: UserID): Promise<void>;
}
