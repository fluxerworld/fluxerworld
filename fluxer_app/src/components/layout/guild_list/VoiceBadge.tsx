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

import guildStyles from '@app/components/layout/GuildsLayout.module.css';
import {MonitorPlayIcon, SpeakerHighIcon, VideoCameraIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type React from 'react';

interface VoiceBadgeProps {
	className?: string;
	activity?: VoiceBadgeActivity;
}

export type VoiceBadgeActivity = 'voice' | 'screenshare' | 'video';

function getVoiceBadgeIcon(activity: VoiceBadgeActivity): React.JSX.Element {
	switch (activity) {
		case 'screenshare':
			return <MonitorPlayIcon weight="fill" className={guildStyles.guildVoiceBadgeIcon} />;
		case 'video':
			return <VideoCameraIcon weight="fill" className={guildStyles.guildVoiceBadgeIcon} />;
		default:
			return <SpeakerHighIcon weight="fill" className={guildStyles.guildVoiceBadgeIcon} />;
	}
}

export function VoiceBadge({className, activity = 'voice'}: VoiceBadgeProps): React.JSX.Element {
	return (
		<div className={clsx(guildStyles.guildVoiceBadge, className)}>
			<div className={guildStyles.guildVoiceBadgeInner}>{getVoiceBadgeIcon(activity)}</div>
		</div>
	);
}
