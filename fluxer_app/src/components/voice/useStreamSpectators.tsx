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

import {
	createVoiceParticipantSortSnapshot,
	sortVoiceParticipantItemsWithSnapshot,
} from '@app/components/voice/VoiceParticipantSortUtils';
import type {UserRecord} from '@app/records/UserRecord';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import {useMemo, useRef} from 'react';

export interface SpectatorEntry {
	userId: string;
	connectionId: string;
	isMobile: boolean;
	user: UserRecord;
}

interface StreamSpectatorsResult {
	viewerIds: ReadonlyArray<string>;
	viewerUsers: ReadonlyArray<UserRecord>;
	spectatorEntries: ReadonlyArray<SpectatorEntry>;
}

export function useStreamSpectators(streamKey: string): StreamSpectatorsResult {
	const localConnectionId = MediaEngineStore.connectionId;
	const spectatorSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());

	const spectatorEntries = useMemo(() => {
		if (!streamKey) return [];

		const allStates = MediaEngineStore.getAllVoiceStates();
		const entries: Array<SpectatorEntry> = [];
		const seenConnections = new Set<string>();

		Object.values(allStates).forEach((guildStates) => {
			Object.values(guildStates).forEach((channelStates) => {
				Object.values(channelStates).forEach((vs: VoiceState) => {
					const isWatchingStream = (vs.viewer_stream_keys ?? []).includes(streamKey);
					const isLocalConnection = localConnectionId != null && vs.connection_id === localConnectionId;
					if (isWatchingStream && vs.user_id && !isLocalConnection && !seenConnections.has(vs.connection_id)) {
						seenConnections.add(vs.connection_id);
						const user = UserStore.getUser(vs.user_id);
						if (user) {
							entries.push({
								userId: vs.user_id,
								connectionId: vs.connection_id,
								isMobile: vs.is_mobile ?? false,
								user,
							});
						}
					}
				});
			});
		});

		return sortVoiceParticipantItemsWithSnapshot(entries, {
			snapshot: spectatorSortSnapshotRef.current,
			getParticipantKey: (entry) => `${entry.userId}:${entry.connectionId}`,
			getUserId: (entry) => entry.userId,
			getTieBreaker: (entry) => entry.connectionId,
		});
	}, [localConnectionId, streamKey]);

	const viewerIds = useMemo(() => {
		const ids = spectatorEntries.map((e) => e.userId);
		return Array.from(new Set(ids));
	}, [spectatorEntries]);

	const viewerUsers = useMemo(() => spectatorEntries.map((e) => e.user), [spectatorEntries]);

	return {viewerIds, viewerUsers, spectatorEntries};
}
