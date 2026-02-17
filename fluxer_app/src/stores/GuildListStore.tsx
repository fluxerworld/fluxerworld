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

import {GuildRecord} from '@app/records/GuildRecord';
import GuildStore from '@app/stores/GuildStore';
import UserSettingsStore, {type GuildFolder} from '@app/stores/UserSettingsStore';
import type {GuildReadyData} from '@app/types/gateway/GatewayGuildTypes';
import {UNCATEGORIZED_FOLDER_ID} from '@fluxer/constants/src/UserConstants';
import type {Guild} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {action, makeAutoObservable} from 'mobx';

export type OrganizedItem =
	| {type: 'folder'; folder: GuildFolder; guilds: Array<GuildRecord>}
	| {type: 'guild'; guild: GuildRecord};

class GuildListStore {
	guilds: Array<GuildRecord> = [];

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	@action
	handleConnectionOpen(guilds: ReadonlyArray<GuildReadyData>): void {
		this.guilds = [];

		const availableGuilds = guilds
			.filter((guild) => !guild.unavailable)
			.map((guild) => GuildStore.getGuild(guild.id))
			.filter((guild): guild is GuildRecord => guild !== undefined);

		if (availableGuilds.length > 0) {
			this.guilds = [...this.sortGuildArray(availableGuilds)];
		}
	}

	@action
	handleGuild(guild: Guild | GuildReadyData): void {
		if (guild.unavailable) {
			return;
		}

		const guildRecord = GuildStore.getGuild(guild.id);
		if (!guildRecord) {
			return;
		}

		const index = this.guilds.findIndex((s) => s.id === guild.id);

		if (index === -1) {
			this.guilds = [...this.sortGuildArray([...this.guilds, guildRecord])];
		} else {
			this.guilds = [
				...this.sortGuildArray([...this.guilds.slice(0, index), guildRecord, ...this.guilds.slice(index + 1)]),
			];
		}
	}

	@action
	handleGuildDelete(guildId: string, unavailable?: boolean): void {
		const index = this.guilds.findIndex((s) => s.id === guildId);
		if (index === -1) {
			return;
		}

		if (unavailable) {
			const existingGuild = this.guilds[index];
			const updatedGuild = new GuildRecord({
				...existingGuild.toJSON(),
				unavailable: true,
			});

			this.guilds = [...this.guilds.slice(0, index), updatedGuild, ...this.guilds.slice(index + 1)];
		} else {
			this.guilds = [...this.guilds.slice(0, index), ...this.guilds.slice(index + 1)];
		}
	}

	@action
	sortGuilds(): void {
		this.guilds = [...this.sortGuildArray([...this.guilds])];
	}

	getOrganizedGuildList(): Array<OrganizedItem> {
		const guildFolders = UserSettingsStore.guildFolders;
		const guildMap = new Map(this.guilds.map((guild) => [guild.id, guild]));
		const result: Array<OrganizedItem> = [];

		for (const folder of guildFolders) {
			const folderGuilds = folder.guildIds
				.map((guildId) => guildMap.get(guildId))
				.filter((guild): guild is GuildRecord => guild !== undefined);

			if (folderGuilds.length === 0) {
				continue;
			}

			if (folder.id === UNCATEGORIZED_FOLDER_ID) {
				for (const guild of folderGuilds) {
					result.push({type: 'guild', guild});
				}
			} else {
				result.push({type: 'folder', folder, guilds: folderGuilds});
			}
		}

		return result;
	}

	private sortGuildArray(guilds: ReadonlyArray<GuildRecord>): ReadonlyArray<GuildRecord> {
		const guildFolders = UserSettingsStore.guildFolders;
		const guildOrder = guildFolders.flatMap((folder) => folder.guildIds);

		return [...guilds].sort((a, b) => {
			const aIndex = guildOrder.indexOf(a.id);
			const bIndex = guildOrder.indexOf(b.id);

			if (aIndex === -1 && bIndex === -1) {
				return a.name.localeCompare(b.name);
			}

			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;

			return aIndex - bIndex;
		});
	}
}

export default new GuildListStore();
