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

import type {UserVoiceActivity} from '@app/hooks/useUserVoiceActivities';
import type {UserRecord} from '@app/records/UserRecord';
import ChannelStore from '@app/stores/ChannelStore';
import GuildStore from '@app/stores/GuildStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {ME} from '@fluxer/constants/src/AppConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useMemo} from 'react';

export function useActiveFriendVoiceStates(): ReadonlyArray<UserVoiceActivity> {
	const relationships = RelationshipStore.getRelationships();
	const allVoiceStates = MediaEngineStore.getAllVoiceStates();
	const currentUser = UserStore.getCurrentUser();
	const currentUserId = currentUser?.id ?? null;

	return useMemo(() => {
		const friendIds = new Set<string>();
		for (const rel of relationships) {
			if (rel.type === RelationshipTypes.FRIEND) {
				friendIds.add(rel.userId);
			}
		}

		const seenChannels = new Set<string>();
		const activities: Array<UserVoiceActivity> = [];

		for (const [guildKey, guildStates] of Object.entries(allVoiceStates)) {
			for (const [channelId, channelStates] of Object.entries(guildStates)) {
				if (seenChannels.has(channelId)) {
					continue;
				}

				const stateEntries = Object.entries(channelStates);
				const friendOrSelfEntry = stateEntries.find(([, vs]) => {
					if (currentUserId && vs.user_id === currentUserId) return true;
					return friendIds.has(vs.user_id) && vs.channel_id;
				});

				if (!friendOrSelfEntry) {
					continue;
				}

				seenChannels.add(channelId);

				const [connectionId, voiceState] = friendOrSelfEntry;
				const effectiveGuildId = guildKey === ME ? null : guildKey;
				const channel = ChannelStore.getChannel(channelId);
				const guild = effectiveGuildId ? GuildStore.getGuild(effectiveGuildId) : undefined;
				const isStreaming = voiceState.self_stream === true;

				const streamKey = isStreaming
					? effectiveGuildId
						? `${effectiveGuildId}:${channelId}:${connectionId}`
						: `dm:${channelId}:${connectionId}`
					: null;

				const participantUserIdSet = new Set<string>();
				for (const vs of Object.values(channelStates)) {
					if (vs.user_id) {
						participantUserIdSet.add(vs.user_id);
					}
				}
				const participantUserIds = Array.from(participantUserIdSet);
				const participantUsers = participantUserIds
					.map((id) => UserStore.getUser(id))
					.filter((u): u is UserRecord => Boolean(u));

				activities.push({
					voiceState,
					connectionId,
					guildId: effectiveGuildId,
					channelId,
					channel,
					guild,
					isStreaming,
					streamKey,
					participantUserIds,
					participantUsers,
				});
			}
		}

		activities.sort((a, b) => b.participantUsers.length - a.participantUsers.length);
		return activities;
	}, [relationships, allVoiceStates, currentUserId]);
}
