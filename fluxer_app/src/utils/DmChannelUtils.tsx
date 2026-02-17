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

import type {ChannelRecord} from '@app/records/ChannelRecord';
import RelationshipStore from '@app/stores/RelationshipStore';
import UserPinnedDMStore from '@app/stores/UserPinnedDMStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {compare, fromTimestamp} from '@fluxer/snowflake/src/SnowflakeUtils';

const getChannelSortSnowflake = (channel: ChannelRecord): string => {
	const baseSnowflake = channel.lastMessageId ?? channel.id;

	if (channel.type !== ChannelTypes.DM) {
		return baseSnowflake;
	}

	const recipientId = channel.recipientIds[0];
	if (!recipientId) {
		return baseSnowflake;
	}

	const relationship = RelationshipStore.getRelationship(recipientId);
	if (!relationship || relationship.type !== RelationshipTypes.FRIEND) {
		return baseSnowflake;
	}

	const sinceTimestamp = relationship.since.getTime();
	if (!Number.isFinite(sinceTimestamp)) {
		return baseSnowflake;
	}

	const friendshipSnowflake = fromTimestamp(sinceTimestamp);
	return compare(friendshipSnowflake, baseSnowflake) > 0 ? friendshipSnowflake : baseSnowflake;
};

export function getSortedDmChannels(
	dmChannels: ReadonlyArray<ChannelRecord>,
	currentUserId?: string | null,
): Array<ChannelRecord> {
	const pinnedOrder = new Map(UserPinnedDMStore.pinnedDMs.map((id, index) => [id, index]));

	const compareChannelIds = (a: ChannelRecord, b: ChannelRecord): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

	return dmChannels
		.filter((channel) => !(channel.type === ChannelTypes.DM_PERSONAL_NOTES || channel.id === currentUserId))
		.sort((a, b) => {
			const aIndex = pinnedOrder.get(a.id);
			const bIndex = pinnedOrder.get(b.id);
			const aIsPinned = aIndex !== undefined;
			const bIsPinned = bIndex !== undefined;

			if (aIsPinned && bIsPinned) {
				const diff = aIndex - bIndex;
				if (diff !== 0) {
					return diff;
				}
				return compareChannelIds(a, b);
			}
			if (aIsPinned !== bIsPinned) {
				return aIsPinned ? -1 : 1;
			}

			const aSortSnowflake = getChannelSortSnowflake(a);
			const bSortSnowflake = getChannelSortSnowflake(b);
			const sortDiff = compare(bSortSnowflake, aSortSnowflake);
			if (sortDiff !== 0) {
				return sortDiff;
			}
			return compareChannelIds(a, b);
		});
}
