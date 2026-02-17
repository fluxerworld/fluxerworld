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
import type {GuildRow} from '@fluxer/api/src/database/types/GuildTypes';
import type {Guild} from '@fluxer/api/src/models/Guild';

export abstract class IGuildDataRepository {
	abstract findUnique(guildId: GuildID): Promise<Guild | null>;
	abstract listGuilds(guildIds: Array<GuildID>): Promise<Array<Guild>>;
	abstract listAllGuildsPaginated(limit: number, lastGuildId?: GuildID): Promise<Array<Guild>>;
	abstract listUserGuilds(userId: UserID): Promise<Array<Guild>>;
	abstract countUserGuilds(userId: UserID): Promise<number>;
	abstract listOwnedGuildIds(userId: UserID): Promise<Array<GuildID>>;
	abstract upsert(data: GuildRow, oldData?: GuildRow | null, previousOwnerId?: UserID): Promise<Guild>;
	abstract delete(guildId: GuildID, ownerId?: UserID): Promise<void>;
}
