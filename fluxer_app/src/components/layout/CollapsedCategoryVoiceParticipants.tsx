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

import styles from '@app/components/layout/CollapsedCategoryVoiceParticipants.module.css';
import {AvatarStack} from '@app/components/uikit/avatars/AvatarStack';
import {StackUserAvatar} from '@app/components/uikit/avatars/StackUserAvatar';
import {
	createVoiceParticipantSortSnapshot,
	sortVoiceParticipantItemsWithSnapshot,
} from '@app/components/voice/VoiceParticipantSortUtils';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {UserRecord} from '@app/records/UserRecord';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {SpeakerHighIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useMemo, useRef} from 'react';

export const CollapsedCategoryVoiceParticipants = observer(
	({guild, voiceChannels}: {guild: GuildRecord; voiceChannels: Array<ChannelRecord>}) => {
		const allVoiceStates = MediaEngineStore.getAllVoiceStates();
		const userSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());

		const userIds = useMemo(() => {
			const ids = new Set<string>();
			for (const channel of voiceChannels) {
				const states = allVoiceStates[guild.id]?.[channel.id];
				if (!states) continue;
				for (const s of Object.values(states)) ids.add(s.user_id);
			}
			return sortVoiceParticipantItemsWithSnapshot(Array.from(ids), {
				snapshot: userSortSnapshotRef.current,
				getParticipantKey: (userId) => userId,
				getUserId: (userId) => userId,
				guildId: guild.id,
			});
		}, [allVoiceStates, guild.id, voiceChannels]);

		if (userIds.length === 0) return null;

		const firstChannelForUser = (uid: string): ChannelRecord | undefined =>
			voiceChannels.find((ch) => {
				const states = allVoiceStates[guild.id]?.[ch.id];
				return !!states && Object.values(states).some((s) => s.user_id === uid);
			});

		const users = useMemo(
			() => userIds.map((userId) => UserStore.getUser(userId)).filter((user): user is UserRecord => !!user),
			[userIds, UserStore.usersList],
		);

		return (
			<div className={styles.container}>
				<SpeakerHighIcon className={styles.icon} />
				<AvatarStack
					size={28}
					maxVisible={7}
					users={users}
					guildId={guild.id}
					renderAvatar={(user, size) => {
						const ch = firstChannelForUser(user.id);
						return ch ? <StackUserAvatar guild={guild} channel={ch} userId={user.id} size={size} /> : null;
					}}
				/>
			</div>
		);
	},
);

export const CollapsedChannelAvatarStack = observer(
	({guild, channel}: {guild: GuildRecord; channel: ChannelRecord}) => {
		const channelStates = MediaEngineStore.getAllVoiceStatesInChannel(guild.id, channel.id);
		const userSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());

		const uniqueUserIds = useMemo(() => {
			const set = new Set<string>();
			for (const s of Object.values(channelStates)) set.add(s.user_id);
			return sortVoiceParticipantItemsWithSnapshot(Array.from(set), {
				snapshot: userSortSnapshotRef.current,
				getParticipantKey: (userId) => userId,
				getUserId: (userId) => userId,
				guildId: guild.id,
				channelId: channel.id,
			});
		}, [channel.id, channelStates, guild.id]);

		const users = useMemo(
			() => uniqueUserIds.map((userId) => UserStore.getUser(userId)).filter((user): user is UserRecord => !!user),
			[uniqueUserIds, UserStore.usersList],
		);

		return (
			<div className={styles.channelContainer}>
				<AvatarStack
					size={28}
					maxVisible={10}
					users={users}
					guildId={guild.id}
					channelId={channel.id}
					renderAvatar={(user, size) => (
						<StackUserAvatar guild={guild} channel={channel} userId={user.id} size={size} />
					)}
				/>
			</div>
		);
	},
);
