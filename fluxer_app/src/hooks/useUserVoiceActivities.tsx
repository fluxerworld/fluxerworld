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
import type {GuildRecord} from '@app/records/GuildRecord';
import type {UserRecord} from '@app/records/UserRecord';
import ChannelStore from '@app/stores/ChannelStore';
import GuildStore from '@app/stores/GuildStore';
import SelectedGuildStore from '@app/stores/SelectedGuildStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import {ME} from '@fluxer/constants/src/AppConstants';
import {useMemo} from 'react';

export interface UserVoiceActivity {
	voiceState: VoiceState;
	connectionId: string;
	guildId: string | null;
	channelId: string;
	channel: ChannelRecord | undefined;
	guild: GuildRecord | undefined;
	isStreaming: boolean;
	streamKey: string | null;
	participantUserIds: ReadonlyArray<string>;
	participantUsers: ReadonlyArray<UserRecord>;
}

export interface UserVoiceActivityAggregate {
	aggregateKey: string;
	primaryActivity: UserVoiceActivity;
	activities: ReadonlyArray<UserVoiceActivity>;
}

function compareVoiceActivitiesForPrimary(a: UserVoiceActivity, b: UserVoiceActivity): number {
	if (a.isStreaming !== b.isStreaming) {
		return a.isStreaming ? -1 : 1;
	}
	return a.connectionId.localeCompare(b.connectionId);
}

function buildAggregateKey(guildId: string | null, channelId: string): string {
	return `${guildId ?? 'dm'}:${channelId}`;
}

export function useUserVoiceActivities(userId: string): ReadonlyArray<UserVoiceActivity> {
	const allVoiceStates = MediaEngineStore.getAllVoiceStates();

	return useMemo(() => {
		const activities: Array<UserVoiceActivity> = [];

		for (const [guildKey, guildStates] of Object.entries(allVoiceStates)) {
			for (const [channelId, channelStates] of Object.entries(guildStates)) {
				for (const [connectionId, vs] of Object.entries(channelStates)) {
					if (vs.user_id !== userId || !vs.channel_id) continue;

					const effectiveGuildId = guildKey === ME ? null : guildKey;
					const channel = ChannelStore.getChannel(channelId);
					const guild = effectiveGuildId ? GuildStore.getGuild(effectiveGuildId) : undefined;
					const isStreaming = vs.self_stream === true;

					const streamKey = isStreaming
						? effectiveGuildId
							? `${effectiveGuildId}:${channelId}:${connectionId}`
							: `dm:${channelId}:${connectionId}`
						: null;

					const participantUserIdSet = new Set<string>();
					for (const pVs of Object.values(channelStates)) {
						if (pVs.user_id) {
							participantUserIdSet.add(pVs.user_id);
						}
					}
					const participantUserIds = Array.from(participantUserIdSet);
					const participantUsers = participantUserIds
						.map((id) => UserStore.getUser(id))
						.filter((u): u is UserRecord => Boolean(u));

					activities.push({
						voiceState: vs,
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
		}

		return activities;
	}, [allVoiceStates, userId]);
}

export function useUserVoiceActivityAggregates(userId: string): ReadonlyArray<UserVoiceActivityAggregate> {
	const activities = useUserVoiceActivities(userId);
	const selectedGuildId = SelectedGuildStore.selectedGuildId;

	return useMemo(() => {
		const groupedActivities = new Map<string, Array<UserVoiceActivity>>();
		for (const activity of activities) {
			const aggregateKey = buildAggregateKey(activity.guildId, activity.channelId);
			const existing = groupedActivities.get(aggregateKey);
			if (existing) {
				existing.push(activity);
				continue;
			}
			groupedActivities.set(aggregateKey, [activity]);
		}

		const aggregates = Array.from(groupedActivities.entries()).map(([aggregateKey, grouped]) => {
			const orderedActivities = [...grouped].sort(compareVoiceActivitiesForPrimary);
			const primaryActivity = orderedActivities[0];
			return {
				aggregateKey,
				primaryActivity,
				activities: orderedActivities,
			};
		});

		aggregates.sort((a, b) => {
			const aGuildId = a.primaryActivity.guildId;
			const bGuildId = b.primaryActivity.guildId;
			const aInSelectedGuild = selectedGuildId != null && aGuildId === selectedGuildId;
			const bInSelectedGuild = selectedGuildId != null && bGuildId === selectedGuildId;

			if (aInSelectedGuild !== bInSelectedGuild) {
				return aInSelectedGuild ? -1 : 1;
			}
			if (a.primaryActivity.isStreaming !== b.primaryActivity.isStreaming) {
				return a.primaryActivity.isStreaming ? -1 : 1;
			}
			if ((aGuildId == null) !== (bGuildId == null)) {
				return aGuildId == null ? 1 : -1;
			}
			if (aGuildId != null && bGuildId != null) {
				const guildSort = aGuildId.localeCompare(bGuildId);
				if (guildSort !== 0) {
					return guildSort;
				}
			}
			return a.primaryActivity.channelId.localeCompare(b.primaryActivity.channelId);
		});

		return aggregates;
	}, [activities, selectedGuildId]);
}
