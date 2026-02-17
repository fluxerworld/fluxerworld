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

import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import GuildNSFWAgreeStore, {NSFWGateReason} from '@app/stores/GuildNSFWAgreeStore';

interface NSFWMediaResult {
	shouldBlur: boolean;
	gateReason: NSFWGateReason;
}

export function useNSFWMedia(nsfw: boolean | undefined, channelId: string | undefined): NSFWMediaResult {
	const mockNSFWMediaGateReason = DeveloperOptionsStore.mockNSFWMediaGateReason;

	const hasGateableContext = channelId ? GuildNSFWAgreeStore.isGatedContent({channelId}) : false;
	const effectiveNSFW = mockNSFWMediaGateReason !== 'none' ? true : !!nsfw || hasGateableContext;
	const gateReasonFromStore = GuildNSFWAgreeStore.getGateReason({channelId: channelId ?? null});

	let gateReason: NSFWGateReason;
	if (mockNSFWMediaGateReason !== 'none') {
		gateReason =
			mockNSFWMediaGateReason === 'geo_restricted' ? NSFWGateReason.GEO_RESTRICTED : NSFWGateReason.AGE_RESTRICTED;
	} else if (effectiveNSFW && channelId) {
		gateReason = gateReasonFromStore;
	} else {
		gateReason = NSFWGateReason.NONE;
	}

	const shouldBlur: boolean =
		effectiveNSFW && gateReason !== NSFWGateReason.NONE && gateReason !== NSFWGateReason.CONSENT_REQUIRED;

	return {shouldBlur, gateReason};
}
