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

import * as SoundActionCreators from '@app/actions/SoundActionCreators';
import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import {usePendingVoiceConnection} from '@app/hooks/usePendingVoiceConnection';
import {useVoiceJoinEligibility} from '@app/hooks/useVoiceJoinEligibility';
import {Logger} from '@app/lib/Logger';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {SoundType} from '@app/utils/SoundUtils';
import {useCallback, useMemo} from 'react';

interface StreamWatchState {
	isWatching: boolean;
	isPendingJoin: boolean;
	canWatch: boolean;
	startWatching: () => void;
	addStream: () => void;
	stopWatching: () => void;
}

const logger = new Logger('useStreamWatchState');

export function useStreamWatchState({
	streamKey,
	guildId,
	channelId,
}: {
	streamKey: string;
	guildId: string | null | undefined;
	channelId: string | null | undefined;
}): StreamWatchState {
	const {canJoin} = useVoiceJoinEligibility({
		guildId: guildId ?? null,
		channelId: channelId ?? null,
	});

	const isConnectedToChannel = useMemo(() => {
		if (!channelId) return false;
		return MediaEngineStore.channelId === channelId && MediaEngineStore.guildId === (guildId ?? null);
	}, [channelId, guildId, MediaEngineStore.channelId, MediaEngineStore.guildId]);

	const replaceViewerStreamKeys = useCallback(
		(keys: Array<string>) => {
			const previousKeys = LocalVoiceStateStore.getViewerStreamKeys();
			const hadStreams = previousKeys.length > 0;
			const hasStreams = keys.length > 0;
			logger.debug('Replacing viewer stream keys', {
				streamKey,
				isConnectedToChannel,
				previousKeys,
				keys,
			});

			LocalVoiceStateStore.updateViewerStreamKeys(keys);
			MediaEngineStore.syncLocalVoiceStateWithServer({viewer_stream_keys: keys});

			if (hadStreams && !hasStreams) {
				SoundActionCreators.playSound(SoundType.ViewerLeave);
				return;
			}

			if (!hadStreams && hasStreams) {
				SoundActionCreators.playSound(SoundType.ViewerJoin);
				return;
			}

			if (hadStreams && hasStreams) {
				SoundActionCreators.playSound(SoundType.ViewerJoin);
			}
		},
		[isConnectedToChannel, streamKey],
	);

	const handleStreamConnected = useCallback(() => {
		replaceViewerStreamKeys([streamKey]);
	}, [streamKey, replaceViewerStreamKeys]);

	const {
		isPending: isPendingJoin,
		startConnection,
		cancel: cancelPendingJoin,
	} = usePendingVoiceConnection({
		guildId,
		channelId,
		onConnected: handleStreamConnected,
	});

	const isWatching = isConnectedToChannel && LocalVoiceStateStore.getViewerStreamKeys().includes(streamKey);
	const canWatch = isConnectedToChannel || canJoin;

	const startWatching = useCallback(() => {
		if (!streamKey) return;
		if (isConnectedToChannel) {
			logger.debug('Starting stream watch in active call', {
				streamKey,
				channelId,
				guildId,
				previousKeys: LocalVoiceStateStore.getViewerStreamKeys(),
			});
			replaceViewerStreamKeys([streamKey]);
			return;
		}

		if (!channelId || !canJoin) return;
		logger.debug('Starting stream watch with pending voice join', {streamKey, channelId, guildId});
		startConnection();
	}, [isConnectedToChannel, streamKey, channelId, canJoin, startConnection, replaceViewerStreamKeys, guildId]);

	const addStream = useCallback(() => {
		if (!streamKey) return;
		if (!isConnectedToChannel) {
			logger.debug('Add stream requested while disconnected, falling back to startWatching', {
				streamKey,
				channelId,
				guildId,
			});
			startWatching();
			return;
		}

		if (LocalVoiceStateStore.getViewerStreamKeys().includes(streamKey)) return;

		const updated = [...LocalVoiceStateStore.getViewerStreamKeys(), streamKey];
		logger.debug('Adding stream to watcher set', {
			streamKey,
			channelId,
			guildId,
			previousKeys: LocalVoiceStateStore.getViewerStreamKeys(),
			updatedKeys: updated,
		});
		LocalVoiceStateStore.updateViewerStreamKeys(updated);
		MediaEngineStore.syncLocalVoiceStateWithServer({viewer_stream_keys: updated});
		SoundActionCreators.playSound(SoundType.ViewerJoin);
	}, [streamKey, isConnectedToChannel, startWatching, channelId, guildId]);

	const stopWatching = useCallback(() => {
		cancelPendingJoin();
		if (!streamKey) return;
		if (!LocalVoiceStateStore.getViewerStreamKeys().includes(streamKey)) return;

		const updated = LocalVoiceStateStore.getViewerStreamKeys().filter((k) => k !== streamKey);
		logger.debug('Stopping stream watch', {
			streamKey,
			channelId,
			guildId,
			previousKeys: LocalVoiceStateStore.getViewerStreamKeys(),
			updatedKeys: updated,
		});
		LocalVoiceStateStore.updateViewerStreamKeys(updated);
		MediaEngineStore.syncLocalVoiceStateWithServer({viewer_stream_keys: updated});
		VoiceCallLayoutActionCreators.setPinnedParticipant(null);
		SoundActionCreators.playSound(SoundType.ViewerLeave);
	}, [streamKey, cancelPendingJoin, channelId, guildId]);

	return {isWatching, isPendingJoin, canWatch, startWatching, addStream, stopWatching};
}
