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

import type {GuildID} from '@fluxer/api/src/BrandedTypes';
import type {GuildFolder} from '@fluxer/api/src/database/types/UserTypes';
import {DEFAULT_GUILD_FOLDER_ICON, type GuildFolderIcon} from '@fluxer/constants/src/UserConstants';

export class UserGuildFolder {
	readonly folderId: number;
	readonly name: string | null;
	readonly color: number | null;
	readonly flags: number;
	readonly icon: GuildFolderIcon;
	readonly guildIds: Array<GuildID>;

	constructor(folder: GuildFolder) {
		this.folderId = folder.folder_id;
		this.name = folder.name ?? null;
		this.color = folder.color ?? null;
		this.flags = folder.flags ?? 0;
		this.icon = folder.icon ?? DEFAULT_GUILD_FOLDER_ICON;
		this.guildIds = folder.guild_ids ?? [];
	}

	toGuildFolder(): GuildFolder {
		return {
			folder_id: this.folderId,
			name: this.name,
			color: this.color,
			flags: this.flags,
			icon: this.icon,
			guild_ids: this.guildIds.length > 0 ? this.guildIds : null,
		};
	}
}
