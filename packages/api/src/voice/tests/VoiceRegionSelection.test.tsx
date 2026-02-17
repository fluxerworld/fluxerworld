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

import type {VoiceRegionAvailability} from '@fluxer/api/src/voice/VoiceModel';
import {resolveVoiceRegionPreference, selectVoiceRegionId} from '@fluxer/api/src/voice/VoiceRegionSelection';
import {describe, expect, it} from 'vitest';

function createRegionAvailability({
	id,
	latitude,
	longitude,
	isDefault,
}: {
	id: string;
	latitude: number;
	longitude: number;
	isDefault: boolean;
}): VoiceRegionAvailability {
	return {
		id,
		name: `Region ${id.toUpperCase()}`,
		emoji: id.toUpperCase(),
		latitude,
		longitude,
		isDefault,
		vipOnly: false,
		requiredGuildFeatures: [],
		isAccessible: true,
		restrictions: {
			vipOnly: false,
			requiredGuildFeatures: new Set(),
			allowedGuildIds: new Set(),
			allowedUserIds: new Set(),
		},
		serverCount: 1,
		activeServerCount: 1,
	};
}

describe('VoiceRegionSelection', () => {
	it('selects the closest region when coordinates are provided', () => {
		const regions = [
			createRegionAvailability({id: 'a', latitude: 0, longitude: 0, isDefault: true}),
			createRegionAvailability({id: 'b', latitude: 50, longitude: 50, isDefault: false}),
		];

		const preference = resolveVoiceRegionPreference({
			preferredRegionId: null,
			accessibleRegions: regions,
			availableRegions: regions,
			defaultRegionId: null,
		});

		const selected = selectVoiceRegionId({
			preferredRegionId: preference.regionId,
			mode: preference.mode,
			accessibleRegions: regions,
			availableRegions: regions,
			latitude: '49',
			longitude: '49',
		});

		expect(selected).toBe('b');
	});

	it('keeps explicit regions even when coordinates would choose another', () => {
		const regions = [
			createRegionAvailability({id: 'a', latitude: 0, longitude: 0, isDefault: false}),
			createRegionAvailability({id: 'b', latitude: 50, longitude: 50, isDefault: false}),
		];

		const preference = resolveVoiceRegionPreference({
			preferredRegionId: 'a',
			accessibleRegions: regions,
			availableRegions: regions,
			defaultRegionId: null,
		});

		const selected = selectVoiceRegionId({
			preferredRegionId: preference.regionId,
			mode: preference.mode,
			accessibleRegions: regions,
			availableRegions: regions,
			latitude: '49',
			longitude: '49',
		});

		expect(preference.mode).toBe('explicit');
		expect(selected).toBe('a');
	});
});
