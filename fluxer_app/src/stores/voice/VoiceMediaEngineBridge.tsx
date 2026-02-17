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

import {Logger} from '@app/lib/Logger';
import type {Participant, Room} from 'livekit-client';

const logger = new Logger('VoiceMediaEngineBridge');

export interface VoiceStatePartial {
	self_video?: boolean;
	self_stream?: boolean;
	self_mute?: boolean;
	self_deaf?: boolean;
	viewer_stream_keys?: Array<string>;
}

interface MediaEngineStoreAccess {
	room?: Room;
	syncLocalVoiceStateWithServer?: (partial: VoiceStatePartial) => void;
	upsertParticipant?: (participant: Participant) => void;
}

function getMediaEngineStore(): MediaEngineStoreAccess | null {
	try {
		if (!('_mediaEngineStore' in window)) return null;
		return (window as {_mediaEngineStore?: MediaEngineStoreAccess})._mediaEngineStore ?? null;
	} catch (error) {
		logger.error('Failed to access media engine store', error);
		return null;
	}
}

export function syncLocalVoiceStateWithServer(partial: VoiceStatePartial): void {
	try {
		const store = getMediaEngineStore();
		store?.syncLocalVoiceStateWithServer?.(partial);
	} catch (error) {
		logger.error('Failed to sync voice state with server', error);
	}
}

export function getRoomFromMediaEngineStore(): Room | null {
	try {
		const store = getMediaEngineStore();
		return store?.room ?? null;
	} catch (error) {
		logger.error('Failed to get room from media engine store', error);
		return null;
	}
}

export function updateLocalParticipantFromRoom(roomOverride?: Room | null): void {
	try {
		const store = getMediaEngineStore();
		if (!store?.upsertParticipant) return;

		const room = roomOverride ?? store.room ?? null;
		if (!room?.localParticipant) return;

		store.upsertParticipant(room.localParticipant);
	} catch (error) {
		logger.error('Failed to update local participant', error);
	}
}
