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
import type {PinnedParticipantSource} from '@app/stores/VoiceCallLayoutStore';
import {isTrackReference, type TrackReferenceOrPlaceholder} from '@livekit/components-react';
import {useEffect, useMemo} from 'react';

type LayoutMode = 'grid' | 'focus';

interface UsePinnedTrackRefArgs {
	layoutMode: LayoutMode;
	pinnedParticipantIdentity: string | null;
	pinnedParticipantSource: PinnedParticipantSource;
	filteredCameraTracks: Array<TrackReferenceOrPlaceholder>;
	cameraTracksAll: Array<TrackReferenceOrPlaceholder>;
	screenShareTracks: Array<TrackReferenceOrPlaceholder>;
	compareTracks: (left: TrackReferenceOrPlaceholder, right: TrackReferenceOrPlaceholder) => number;
}

function identityOf(track: TrackReferenceOrPlaceholder): string {
	return track.participant?.identity ?? '';
}

function sortByParticipant(
	tracks: Array<TrackReferenceOrPlaceholder>,
	compareTracks: UsePinnedTrackRefArgs['compareTracks'],
) {
	return [...tracks].sort(compareTracks);
}

function sortByMostRecentSpeaking(
	tracks: Array<TrackReferenceOrPlaceholder>,
	compareTracks: UsePinnedTrackRefArgs['compareTracks'],
): Array<TrackReferenceOrPlaceholder> {
	return [...tracks].sort((a, b) => {
		const aSpeaking = a.participant?.isSpeaking === true ? 1 : 0;
		const bSpeaking = b.participant?.isSpeaking === true ? 1 : 0;
		if (aSpeaking !== bSpeaking) {
			return bSpeaking - aSpeaking;
		}

		const aLastSpokeAt = a.participant?.lastSpokeAt?.getTime() ?? 0;
		const bLastSpokeAt = b.participant?.lastSpokeAt?.getTime() ?? 0;
		if (aLastSpokeAt !== bLastSpokeAt) {
			return bLastSpokeAt - aLastSpokeAt;
		}

		return compareTracks(a, b);
	});
}

function findByIdentity(
	tracks: Array<TrackReferenceOrPlaceholder>,
	identity: string | null,
): TrackReferenceOrPlaceholder | null {
	if (!identity) return null;
	return tracks.find((t) => identityOf(t) === identity) ?? null;
}

function findByIdentityAndSource(
	tracks: Array<TrackReferenceOrPlaceholder>,
	identity: string | null,
	source: PinnedParticipantSource,
): TrackReferenceOrPlaceholder | null {
	if (!identity || !source) return null;
	return tracks.find((track) => identityOf(track) === identity && track.source === source) ?? null;
}

function dedupeTracksByIdentityAndSource(
	tracks: Array<TrackReferenceOrPlaceholder>,
): Array<TrackReferenceOrPlaceholder> {
	const seen = new Set<string>();
	const deduped: Array<TrackReferenceOrPlaceholder> = [];

	for (const track of tracks) {
		const key = `${identityOf(track)}::${track.source}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(track);
	}

	return deduped;
}

export function usePinnedTrackRef({
	layoutMode,
	pinnedParticipantIdentity,
	pinnedParticipantSource,
	filteredCameraTracks,
	cameraTracksAll,
	screenShareTracks,
	compareTracks,
}: UsePinnedTrackRefArgs) {
	const cameraBase = filteredCameraTracks.length > 0 ? filteredCameraTracks : cameraTracksAll;

	const camerasSorted = useMemo(() => sortByParticipant(cameraBase, compareTracks), [cameraBase, compareTracks]);
	const camerasAllSorted = useMemo(
		() => sortByParticipant(cameraTracksAll, compareTracks),
		[cameraTracksAll, compareTracks],
	);
	const camerasByMostRecentSpeaking = useMemo(
		() => sortByMostRecentSpeaking(cameraBase, compareTracks),
		[cameraBase, compareTracks],
	);
	const screensSorted = useMemo(
		() => sortByParticipant(screenShareTracks, compareTracks),
		[screenShareTracks, compareTracks],
	);

	const defaultFocusTrack = useMemo<TrackReferenceOrPlaceholder | null>(() => {
		return screensSorted[0] ?? camerasByMostRecentSpeaking[0] ?? camerasSorted[0] ?? null;
	}, [screensSorted, camerasByMostRecentSpeaking, camerasSorted]);

	const pinnedTrack = useMemo(() => {
		const allTracks = [...screensSorted, ...camerasAllSorted];
		const fromSource = findByIdentityAndSource(allTracks, pinnedParticipantIdentity, pinnedParticipantSource);
		if (fromSource) return fromSource;

		const fromScreens = findByIdentity(screensSorted, pinnedParticipantIdentity);
		if (fromScreens) return fromScreens;
		return findByIdentity(camerasAllSorted, pinnedParticipantIdentity);
	}, [screensSorted, camerasAllSorted, pinnedParticipantIdentity, pinnedParticipantSource]);

	const mainTrack = useMemo<TrackReferenceOrPlaceholder | null>(() => {
		if (layoutMode !== 'focus') return null;
		return pinnedTrack ?? defaultFocusTrack;
	}, [layoutMode, pinnedTrack, defaultFocusTrack]);

	const carouselTracks = useMemo<Array<TrackReferenceOrPlaceholder>>(
		() => dedupeTracksByIdentityAndSource([...screensSorted, ...camerasSorted]),
		[screensSorted, camerasSorted],
	);
	const pipTrack = useMemo<TrackReferenceOrPlaceholder | null>(
		() => pinnedTrack ?? defaultFocusTrack,
		[pinnedTrack, defaultFocusTrack],
	);

	useEffect(() => {
		if (layoutMode !== 'focus') return;
		if (pinnedParticipantIdentity) return;

		if (defaultFocusTrack && isTrackReference(defaultFocusTrack)) {
			const identity = identityOf(defaultFocusTrack);
			if (identity) VoiceCallLayoutActionCreators.setPinnedParticipant(identity, defaultFocusTrack.source);
		}
	}, [layoutMode, pinnedParticipantIdentity, defaultFocusTrack]);

	return {mainTrack, carouselTracks, pipTrack};
}
