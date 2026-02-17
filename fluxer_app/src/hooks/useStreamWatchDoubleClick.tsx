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

import * as PopoutActionCreators from '@app/actions/PopoutActionCreators';
import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import {usePendingVoiceConnection} from '@app/hooks/usePendingVoiceConnection';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {Track} from 'livekit-client';
import {useCallback, useMemo, useRef} from 'react';

interface UseStreamWatchDoubleClickOptions {
	streamParticipantIdentity: string | null;
	guildId: string | null;
	channelId: string | null;
	startWatching: () => void;
	onNavigateToWatch?: () => void;
}

interface UseStreamWatchDoubleClickResult {
	onClick: (event: React.MouseEvent) => void;
	onDoubleClick: (event: React.MouseEvent) => void;
}

export function useStreamWatchDoubleClick({
	streamParticipantIdentity,
	guildId,
	channelId,
	startWatching,
	onNavigateToWatch,
}: UseStreamWatchDoubleClickOptions): UseStreamWatchDoubleClickResult {
	const lastClickTimeRef = useRef<number>(0);

	const isConnectedToChannel = useMemo(() => {
		if (!channelId) return false;
		return MediaEngineStore.channelId === channelId && MediaEngineStore.guildId === (guildId ?? null);
	}, [channelId, guildId, MediaEngineStore.channelId, MediaEngineStore.guildId]);

	const handleNavigateToWatch = useCallback(() => {
		onNavigateToWatch?.();
	}, [onNavigateToWatch]);

	const {markPending: markWatchNavigationPending} = usePendingVoiceConnection({
		guildId,
		channelId,
		onConnected: handleNavigateToWatch,
	});

	const onClick = useCallback(
		(event: React.MouseEvent) => {
			const now = Date.now();
			const timeSinceLastClick = now - lastClickTimeRef.current;
			lastClickTimeRef.current = now;

			if (timeSinceLastClick < 300 && streamParticipantIdentity) {
				event.preventDefault();
				event.stopPropagation();
				PopoutActionCreators.closeAll();
				startWatching();
				VoiceCallLayoutActionCreators.setLayoutMode('focus');
				VoiceCallLayoutActionCreators.setPinnedParticipant(streamParticipantIdentity, Track.Source.ScreenShare);
				VoiceCallLayoutActionCreators.markUserOverride();
				if (isConnectedToChannel) {
					handleNavigateToWatch();
				} else if (channelId) {
					markWatchNavigationPending();
				}
			}
		},
		[
			streamParticipantIdentity,
			startWatching,
			isConnectedToChannel,
			channelId,
			handleNavigateToWatch,
			markWatchNavigationPending,
		],
	);

	const onDoubleClick = useCallback(
		(event: React.MouseEvent) => {
			if (!streamParticipantIdentity) return;
			event.preventDefault();
			event.stopPropagation();
		},
		[streamParticipantIdentity],
	);

	return {onClick, onDoubleClick};
}
