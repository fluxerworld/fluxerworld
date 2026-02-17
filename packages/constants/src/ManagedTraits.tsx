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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const MANAGED_TRAIT_PREFIX = 'MT_';

export const ManagedTraits = {
	MESSAGE_SCHEDULING: 'MT_MESSAGE_SCHEDULING',
	EXPRESSION_PACKS: 'MT_EXPRESSION_PACKS',
} as const;

export type ManagedTrait = ValueOf<typeof ManagedTraits>;

export const ALL_MANAGED_TRAITS: Array<ManagedTrait> = Object.values(ManagedTraits);

export function isManagedTrait(value: string): value is ManagedTrait {
	return value.startsWith(MANAGED_TRAIT_PREFIX);
}
