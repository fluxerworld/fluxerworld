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

import {makePersistent} from '@app/lib/MobXPersistence';
import ChannelStore from '@app/stores/ChannelStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import GeoIPStore from '@app/stores/GeoIPStore';
import GuildStore from '@app/stores/GuildStore';
import UserStore from '@app/stores/UserStore';
import {GuildNSFWLevel} from '@fluxer/constants/src/GuildConstants';
import {makeAutoObservable} from 'mobx';

export enum NSFWGateReason {
	NONE = 0,
	GEO_RESTRICTED = 1,
	AGE_RESTRICTED = 2,
	CONSENT_REQUIRED = 3,
}

export interface NSFWGateContext {
	channelId?: string | null;
	guildId?: string | null;
}

class GuildNSFWAgreeStore {
	agreedChannelIds: Array<string> = [];
	agreedGuildIds: Array<string> = [];

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		void this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'GuildNSFWAgreeStore', ['agreedChannelIds', 'agreedGuildIds']);
	}

	agreeToChannel(channelId: string): void {
		if (!this.agreedChannelIds.includes(channelId)) {
			this.agreedChannelIds.push(channelId);
		}
	}

	agreeToGuild(guildId: string): void {
		if (!this.agreedGuildIds.includes(guildId)) {
			this.agreedGuildIds.push(guildId);
		}
	}

	reset(): void {
		this.agreedChannelIds = [];
		this.agreedGuildIds = [];
	}

	hasAgreedToChannel(channelId: string): boolean {
		return this.agreedChannelIds.includes(channelId);
	}

	hasAgreedToGuild(guildId: string): boolean {
		return this.agreedGuildIds.includes(guildId);
	}

	private resolveContext(context: NSFWGateContext): {
		channelId: string | null;
		guildId: string | null;
		channelIsNsfw: boolean;
		guildIsAgeRestricted: boolean;
	} {
		const channelId = context.channelId ?? null;
		const guildIdFromArg = context.guildId ?? null;

		const channel = channelId ? ChannelStore.getChannel(channelId) : null;
		const guildId = guildIdFromArg ?? channel?.guildId ?? null;

		const guild = guildId ? GuildStore.getGuild(guildId) : null;
		const guildIsAgeRestricted = guild?.nsfwLevel === GuildNSFWLevel.AGE_RESTRICTED;
		const channelIsNsfw = channel?.isNSFW() ?? false;

		return {channelId, guildId, channelIsNsfw, guildIsAgeRestricted};
	}

	isGatedContent(context: NSFWGateContext): boolean {
		const {channelIsNsfw, guildIsAgeRestricted} = this.resolveContext(context);
		return channelIsNsfw || guildIsAgeRestricted;
	}

	getGateReason(context: NSFWGateContext): NSFWGateReason {
		const mockReason = DeveloperOptionsStore.mockNSFWGateReason;
		if (mockReason !== 'none') {
			switch (mockReason) {
				case 'geo_restricted':
					return NSFWGateReason.GEO_RESTRICTED;
				case 'age_restricted':
					return NSFWGateReason.AGE_RESTRICTED;
				case 'consent_required':
					return NSFWGateReason.CONSENT_REQUIRED;
			}
		}

		const resolved = this.resolveContext(context);
		if (!resolved.channelIsNsfw && !resolved.guildIsAgeRestricted) {
			return NSFWGateReason.NONE;
		}

		const countryCode = GeoIPStore.countryCode;
		const regionCode = GeoIPStore.regionCode;
		const ageRestrictedGeos = GeoIPStore.ageRestrictedGeos;

		if (countryCode) {
			const isAgeRestricted = ageRestrictedGeos.some((geo) => {
				if (geo.countryCode !== countryCode) return false;
				if (geo.regionCode === null) return true;
				return geo.regionCode === regionCode;
			});

			if (isAgeRestricted) {
				return NSFWGateReason.GEO_RESTRICTED;
			}
		}

		const currentUser = UserStore.getCurrentUser();
		if (currentUser && !currentUser.nsfwAllowed) {
			return NSFWGateReason.AGE_RESTRICTED;
		}

		if (resolved.guildIsAgeRestricted) {
			if (!resolved.guildId || !this.hasAgreedToGuild(resolved.guildId)) {
				return NSFWGateReason.CONSENT_REQUIRED;
			}
			return NSFWGateReason.NONE;
		}

		if (!resolved.channelId || !this.hasAgreedToChannel(resolved.channelId)) {
			return NSFWGateReason.CONSENT_REQUIRED;
		}

		return NSFWGateReason.NONE;
	}

	shouldShowGate(context: NSFWGateContext): boolean {
		return this.getGateReason(context) !== NSFWGateReason.NONE;
	}
}

export default new GuildNSFWAgreeStore();
