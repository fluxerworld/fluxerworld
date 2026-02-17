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

import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import {MAX_GUILD_MEMBERS, MAX_GUILD_MEMBERS_VERY_LARGE_GUILD} from '@fluxer/constants/src/LimitConstants';
import {DEFAULT_FREE_LIMITS} from '@fluxer/limits/src/LimitDefaults';
import {resolveLimit} from '@fluxer/limits/src/LimitResolver';
import type {LimitConfigSnapshot} from '@fluxer/limits/src/LimitTypes';

function toGuildFeatureSet(guildFeatures: Iterable<string> | null | undefined): Set<string> {
	const featureSet = new Set<string>();
	if (!guildFeatures) {
		return featureSet;
	}
	for (const feature of guildFeatures) {
		if (feature) {
			featureSet.add(feature);
		}
	}
	return featureSet;
}

export function resolveDefaultMaxGuildMembers(guildFeatures: Iterable<string> | null | undefined): number {
	const featureSet = toGuildFeatureSet(guildFeatures);
	if (featureSet.has(GuildFeatures.VERY_LARGE_GUILD)) {
		return MAX_GUILD_MEMBERS_VERY_LARGE_GUILD;
	}
	return MAX_GUILD_MEMBERS;
}

export function resolveMaxGuildMembersLimit(params: {
	guildFeatures: Iterable<string> | null | undefined;
	snapshot: LimitConfigSnapshot | null | undefined;
}): number {
	const featureSet = toGuildFeatureSet(params.guildFeatures);
	const defaultLimit = resolveDefaultMaxGuildMembers(featureSet);

	if (!params.snapshot) {
		return defaultLimit;
	}

	const ctx = createLimitMatchContext({guildFeatures: featureSet});
	const resolved = resolveLimit(params.snapshot, ctx, 'max_guild_members', {
		evaluationContext: 'guild',
		baseLimits: {
			...DEFAULT_FREE_LIMITS,
			max_guild_members: defaultLimit,
		},
	});
	if (!Number.isFinite(resolved) || resolved < 0) {
		return defaultLimit;
	}
	return Math.floor(resolved);
}
