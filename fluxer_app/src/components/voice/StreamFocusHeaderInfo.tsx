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

import channelHeaderStyles from '@app/components/channel/ChannelHeader.module.css';
import {Avatar} from '@app/components/uikit/Avatar';
import {AvatarStack} from '@app/components/uikit/avatars/AvatarStack';
import {StreamSpectatorsPopout} from '@app/components/voice/StreamSpectatorsPopout';
import type {SpectatorEntry} from '@app/components/voice/useStreamSpectators';
import styles from '@app/components/voice/VoiceCallView.module.css';
import type {UserRecord} from '@app/records/UserRecord';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';

interface StreamFocusHeaderInfoProps {
	streamerUser: UserRecord;
	streamerDisplayName: string;
	viewerUsers: ReadonlyArray<UserRecord>;
	spectatorEntries: ReadonlyArray<SpectatorEntry>;
	guildId?: string;
	channelId: string;
	onOpenChange?: (open: boolean) => void;
}

export function StreamFocusHeaderInfo({
	streamerUser,
	streamerDisplayName,
	viewerUsers,
	spectatorEntries,
	guildId,
	channelId,
	onOpenChange,
}: StreamFocusHeaderInfoProps) {
	const {t} = useLingui();

	return (
		<div className={styles.streamFocusInfo}>
			<span className={clsx(channelHeaderStyles.topicDivider, styles.streamFocusTopicDivider)}>•</span>
			<div className={styles.streamFocusStreamer}>
				<Avatar user={streamerUser} size={20} guildId={guildId} />
				<span className={styles.streamFocusStreamerName}>{t`${streamerDisplayName}'s Screen`}</span>
			</div>
			{viewerUsers.length > 0 && (
				<StreamSpectatorsPopout
					viewerUsers={viewerUsers}
					spectatorEntries={spectatorEntries}
					guildId={guildId}
					channelId={channelId}
					onOpenChange={onOpenChange}
				>
					<div className={styles.streamFocusSpectators}>
						<AvatarStack size={20} maxVisible={5} users={viewerUsers} guildId={guildId} channelId={channelId} />
					</div>
				</StreamSpectatorsPopout>
			)}
		</div>
	);
}
