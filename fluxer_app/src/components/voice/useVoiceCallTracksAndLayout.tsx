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

import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import {parseStreamKey} from '@app/components/voice/StreamKeys';
import {usePinnedTrackRef} from '@app/components/voice/usePinnedTrackRef';
import {
	compareVoiceTrackReferencesWithSnapshot,
	createVoiceParticipantSortSnapshot,
	syncVoiceParticipantSortSnapshot,
} from '@app/components/voice/VoiceParticipantSortUtils';
import {parseVoiceParticipantIdentity} from '@app/components/voice/VoiceParticipantSpeakingUtils';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import CallMediaPrefsStore from '@app/stores/CallMediaPrefsStore';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import UserStore from '@app/stores/UserStore';
import VoiceCallLayoutStore from '@app/stores/VoiceCallLayoutStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {
	isTrackReference,
	type TrackReferenceOrPlaceholder,
	useParticipants,
	useTracks,
} from '@livekit/components-react';
import {RoomEvent, Track} from 'livekit-client';
import {useCallback, useEffect, useMemo, useRef} from 'react';

interface UseVoiceCallTracksAndLayoutArgs {
	channel: ChannelRecord;
}

export function useVoiceCallTracksAndLayout({channel}: UseVoiceCallTracksAndLayoutArgs) {
	const {layoutMode, pinnedParticipantIdentity, pinnedParticipantSource} = VoiceCallLayoutStore;
	const trackSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());
	const compareTracks = useCallback(
		(left: TrackReferenceOrPlaceholder, right: TrackReferenceOrPlaceholder) =>
			compareVoiceTrackReferencesWithSnapshot(
				left,
				right,
				trackSortSnapshotRef.current,
				channel.guildId ?? null,
				channel.id,
			),
		[channel.guildId, channel.id],
	);

	const tracks = useTracks(
		[
			{source: Track.Source.Camera, withPlaceholder: true},
			{source: Track.Source.ScreenShare, withPlaceholder: false},
		],
		{
			updateOnlyOn: [
				RoomEvent.ParticipantConnected,
				RoomEvent.ParticipantDisconnected,
				RoomEvent.TrackPublished,
				RoomEvent.TrackUnpublished,
				RoomEvent.TrackMuted,
				RoomEvent.TrackUnmuted,
				RoomEvent.TrackSubscribed,
				RoomEvent.TrackUnsubscribed,
				RoomEvent.ActiveSpeakersChanged,
			],
			onlySubscribed: false,
		},
	);
	const participants = useParticipants();

	const {screenShareTracks, cameraTracksAll} = useMemo(() => {
		const refs = tracks.filter(isTrackReference);
		const screens = refs.filter((tr) => tr.publication.source === Track.Source.ScreenShare);
		const camerasPlusPlaceholders = tracks.filter((tr) => tr.source !== Track.Source.ScreenShare);
		return {screenShareTracks: screens, cameraTracksAll: camerasPlusPlaceholders};
	}, [tracks]);

	const virtualScreenShareTracks = useMemo<Array<TrackReferenceOrPlaceholder>>(() => {
		const viewerStreamKeys = LocalVoiceStateStore.getViewerStreamKeys();
		if (viewerStreamKeys.length === 0) return [];

		const virtualTracks: Array<TrackReferenceOrPlaceholder> = [];

		for (const viewerStreamKey of viewerStreamKeys) {
			const parsed = parseStreamKey(viewerStreamKey);
			if (!parsed) continue;
			if (parsed.channelId !== channel.id) continue;

			const channelGuildId = channel.guildId ?? null;
			if (parsed.guildId !== channelGuildId) continue;

			const voiceState = MediaEngineStore.getVoiceStateByConnectionId(parsed.connectionId);
			if (!voiceState?.user_id) continue;
			if (voiceState.channel_id !== channel.id) continue;

			const identity = `user_${voiceState.user_id}_${parsed.connectionId}`;
			const alreadyActive = screenShareTracks.some((tr) => tr.participant.identity === identity);
			if (alreadyActive) continue;

			const participant = participants.find((p) => p.identity === identity);
			if (!participant) continue;

			virtualTracks.push({participant, source: Track.Source.ScreenShare});
		}

		return virtualTracks;
	}, [channel.id, channel.guildId, participants, screenShareTracks]);

	const screenShareTracksWithVirtual = useMemo(
		() =>
			virtualScreenShareTracks.length > 0 ? [...screenShareTracks, ...virtualScreenShareTracks] : screenShareTracks,
		[screenShareTracks, virtualScreenShareTracks],
	);
	const trackSnapshotMembers = useMemo(
		() =>
			[...cameraTracksAll, ...screenShareTracksWithVirtual].map((trackRef) => {
				const identity = parseVoiceParticipantIdentity(trackRef.participant.identity);
				return {
					participantKey: `${identity.userId}:${identity.connectionId}`,
					userId: identity.userId,
				};
			}),
		[cameraTracksAll, screenShareTracksWithVirtual],
	);
	syncVoiceParticipantSortSnapshot(
		trackSortSnapshotRef.current,
		trackSnapshotMembers,
		channel.guildId ?? null,
		channel.id,
	);

	const sortedCameraTracksAll = useMemo(
		() => [...cameraTracksAll].sort(compareTracks),
		[cameraTracksAll, compareTracks],
	);

	const filteredCameraTracks = useMemo(() => {
		if (VoiceSettingsStore.showNonVideoParticipants) return cameraTracksAll;

		const screenShareParticipantIdentities = new Set(
			screenShareTracksWithVirtual.map((track) => track.participant.identity),
		);

		return cameraTracksAll.filter((tr) => {
			const participantIdentity = tr.participant.identity;
			if (screenShareParticipantIdentities.has(participantIdentity)) return true;

			if (!isTrackReference(tr)) return false;
			if (!tr.publication) return false;
			return !tr.publication.isMuted;
		});
	}, [cameraTracksAll, screenShareTracksWithVirtual, VoiceSettingsStore.showNonVideoParticipants]);
	const sortedFilteredCameraTracks = useMemo(
		() => [...filteredCameraTracks].sort(compareTracks),
		[filteredCameraTracks, compareTracks],
	);
	const sortedScreenShareTracksWithVirtual = useMemo(
		() => [...screenShareTracksWithVirtual].sort(compareTracks),
		[screenShareTracksWithVirtual, compareTracks],
	);

	const hasScreenShare = sortedScreenShareTracksWithVirtual.length > 0;

	useEffect(() => {
		const callId = MediaEngineStore.connectionId ?? '';
		const currentUserId = UserStore.currentUser?.id;
		if (!callId || !currentUserId) return;

		for (const tr of cameraTracksAll) {
			if (!isTrackReference(tr)) continue;
			if (tr.source !== Track.Source.Camera) continue;

			const identity = tr.participant.identity || '';
			if (!identity.startsWith(`user_${currentUserId}_`)) continue;

			const isPublishing = Boolean(tr.publication && !tr.publication.isMuted);
			const disabled = !VoiceSettingsStore.showMyOwnCamera && isPublishing;
			CallMediaPrefsStore.setVideoDisabled(callId, identity, disabled);
		}
	}, [cameraTracksAll, VoiceSettingsStore.showMyOwnCamera]);

	useEffect(() => {
		if (!pinnedParticipantIdentity) return;
		if (cameraTracksAll.length === 0) return;

		const stillExists = cameraTracksAll.some((tr) => tr.participant.identity === pinnedParticipantIdentity);
		if (!stillExists) VoiceCallLayoutActionCreators.setPinnedParticipant(null);
	}, [cameraTracksAll, pinnedParticipantIdentity]);

	const {
		mainTrack: focusMainTrack,
		carouselTracks,
		pipTrack,
	} = usePinnedTrackRef({
		layoutMode,
		pinnedParticipantIdentity,
		pinnedParticipantSource,
		filteredCameraTracks: sortedFilteredCameraTracks,
		cameraTracksAll: sortedCameraTracksAll,
		screenShareTracks: sortedScreenShareTracksWithVirtual,
		compareTracks,
	});

	return {
		tracks,
		screenShareTracks: sortedScreenShareTracksWithVirtual,
		cameraTracksAll: sortedCameraTracksAll,
		filteredCameraTracks: sortedFilteredCameraTracks,
		hasScreenShare,

		layoutMode,
		pinnedParticipantIdentity,
		pinnedParticipantSource,

		focusMainTrack,
		carouselTracks,
		pipTrack,

		channel,
	};
}
