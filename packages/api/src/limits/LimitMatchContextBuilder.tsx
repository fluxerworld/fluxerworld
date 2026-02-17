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

import type {User} from '@fluxer/api/src/models/User';
import {checkIsPremium} from '@fluxer/api/src/user/UserHelpers';
import type {LimitMatchContext} from '@fluxer/limits/src/LimitTypes';

export function createLimitMatchContext({
	user,
	guildFeatures,
}: {
	user?: User | null;
	guildFeatures?: Iterable<string> | null;
}): LimitMatchContext {
	const traits = new Set<string>();
	const traitValues = user?.traits ? Array.from(user.traits) : [];
	for (const trait of traitValues) {
		if (trait && trait !== 'premium') traits.add(trait);
	}
	if (user && checkIsPremium(user)) {
		traits.add('premium');
	}
	const guildFeatureSet = new Set<string>();
	if (guildFeatures) {
		for (const feature of guildFeatures) {
			if (feature) guildFeatureSet.add(feature);
		}
	}
	return {traits, guildFeatures: guildFeatureSet};
}
