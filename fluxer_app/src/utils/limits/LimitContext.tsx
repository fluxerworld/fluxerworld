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

import ChannelStore from '@app/stores/ChannelStore';
import GuildStore from '@app/stores/GuildStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import SelectedGuildStore from '@app/stores/SelectedGuildStore';
import UserStore from '@app/stores/UserStore';

export interface LimitContextInput {
	traits?: Iterable<string> | null;
	guildFeatures?: Iterable<string> | null;
	guildId?: string | null;
}

export interface LimitMatchContext {
	traits: Set<string>;
	guildFeatures: Set<string>;
}

class LimitContextClass {
	current(): LimitMatchContext {
		return this.build({});
	}

	build(options: LimitContextInput = {}): LimitMatchContext {
		const currentUser = UserStore.getCurrentUser();

		const traitSet = new Set<string>();
		const traitsSource = options.traits ?? currentUser?.traits ?? [];
		for (const trait of traitsSource) {
			if (trait) traitSet.add(trait);
		}

		const guildFeatureSet = new Set<string>();
		if (options.guildFeatures !== undefined) {
			for (const feature of options.guildFeatures ?? []) {
				if (feature) guildFeatureSet.add(feature);
			}
		} else {
			const guildFeatures = this._getGuildFeatures(options.guildId);
			if (guildFeatures) {
				for (const feature of guildFeatures) {
					if (feature) guildFeatureSet.add(feature);
				}
			}
		}

		return {
			traits: traitSet,
			guildFeatures: guildFeatureSet,
		};
	}

	private _getGuildFeatures(guildIdOverride?: string | null): Iterable<string> | null {
		if (guildIdOverride !== undefined) {
			if (!guildIdOverride) return null;
			const guild = GuildStore.getGuild(guildIdOverride);
			return guild?.features ?? null;
		}

		const channelId = SelectedChannelStore.currentChannelId;
		const channel = channelId ? ChannelStore.getChannel(channelId) : null;
		const guildId = channel?.guildId ?? SelectedGuildStore.selectedGuildId;
		if (!guildId) return null;

		const guild = GuildStore.getGuild(guildId);
		return guild?.features ?? null;
	}

	premium(): LimitMatchContext {
		return this.build({traits: ['premium']});
	}

	free(): LimitMatchContext {
		const currentUser = UserStore.getCurrentUser();
		const traits = currentUser?.traits ? Array.from(currentUser.traits).filter((t) => t !== 'premium') : [];
		return this.build({traits});
	}

	forGuild(guildId: string): LimitMatchContext {
		return this.build({guildId});
	}

	forUser(traits: Iterable<string> = []): LimitMatchContext {
		return this.build({traits});
	}
}

export const LimitContext = new LimitContextClass();
