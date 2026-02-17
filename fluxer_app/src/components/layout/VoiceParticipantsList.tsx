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

import {GroupedVoiceParticipant} from '@app/components/layout/GroupedVoiceParticipant';
import {VoiceParticipantItem} from '@app/components/layout/VoiceParticipantItem';
import styles from '@app/components/layout/VoiceParticipantsList.module.css';
import {
	createVoiceParticipantSortSnapshot,
	sortVoiceParticipantItemsWithSnapshot,
} from '@app/components/voice/VoiceParticipantSortUtils';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import {observer} from 'mobx-react-lite';
import {useMemo, useRef} from 'react';

export const VoiceParticipantsList = observer(({guild, channel}: {guild: GuildRecord; channel: ChannelRecord}) => {
	const voiceStates = MediaEngineStore.getAllVoiceStatesInChannel(guild.id, channel.id);
	const currentUser = UserStore.currentUser;
	const localSelfStream = LocalVoiceStateStore.selfStream;
	const groupedSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());

	const grouped = useMemo(() => {
		const byUser = new Map<
			string,
			{
				userId: string;
				states: Array<VoiceState>;
				isCurrentUser: boolean;
				anySpeaking: boolean;
				anyLive: boolean;
			}
		>();

		for (const vs of Object.values(voiceStates)) {
			const userId = vs.user_id;
			let entry = byUser.get(userId);
			if (!entry) {
				entry = {userId, states: [], isCurrentUser: currentUser?.id === userId, anySpeaking: false, anyLive: false};
				byUser.set(userId, entry);
			}
			entry.states.push(vs);

			const connectionId = vs.connection_id ?? '';
			const participant = MediaEngineStore.getParticipantByUserIdAndConnectionId(userId, connectionId);
			const isSelfMuted = vs.self_mute ?? (participant ? !participant.isMicrophoneEnabled : false);
			const isGuildMuted = vs.mute ?? false;
			const speaking = !!(participant?.isSpeaking && !isSelfMuted && !isGuildMuted);
			const live = vs.self_stream === true || (participant ? participant.isScreenShareEnabled : false);

			entry.anySpeaking = entry.anySpeaking || speaking;
			entry.anyLive = entry.anyLive || live;

			if (entry.isCurrentUser) {
				entry.anyLive = entry.anyLive || localSelfStream;
			}
		}

		return sortVoiceParticipantItemsWithSnapshot(Array.from(byUser.values()), {
			snapshot: groupedSortSnapshotRef.current,
			getParticipantKey: (entry) => entry.userId,
			getUserId: (entry) => entry.userId,
			guildId: guild.id,
			channelId: channel.id,
		});
	}, [channel.id, currentUser, guild.id, localSelfStream, voiceStates]);

	if (grouped.length === 0) return null;

	return (
		<div className={styles.container}>
			{grouped.map(({userId, states, isCurrentUser, anySpeaking}) => {
				const user = UserStore.getUser(userId);
				if (!user) return null;

				if (states.length === 1) {
					return (
						<VoiceParticipantItem
							key={userId}
							user={user}
							voiceState={states[0]}
							guildId={guild.id}
							isCurrentUser={isCurrentUser}
						/>
					);
				}

				return (
					<GroupedVoiceParticipant
						key={userId}
						user={user}
						voiceStates={states}
						guildId={guild.id}
						anySpeaking={anySpeaking}
					/>
				);
			})}
		</div>
	);
});
