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
import {Logger} from '@app/lib/Logger';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import ParticipantVolumeStore from '@app/stores/ParticipantVolumeStore';
import VoiceConnectionManager from '@app/stores/voice/VoiceConnectionManager';
import VoiceMediaManager from '@app/stores/voice/VoiceMediaManager';
import VoiceMediaStateCoordinator from '@app/stores/voice/VoiceMediaStateCoordinator';
import VoiceParticipantManager from '@app/stores/voice/VoiceParticipantManager';
import VoicePermissionManager from '@app/stores/voice/VoicePermissionManager';
import {SoundType} from '@app/utils/SoundUtils';
import type {Participant, RemoteParticipant, Room} from 'livekit-client';
import {RoomEvent, Track} from 'livekit-client';

const logger = new Logger('VoiceRoomEventBinder');

export interface RoomEventCallbacks {
	onConnected: () => Promise<void>;
	onDisconnected: () => void;
	onReconnecting: () => void;
	onReconnected: () => void;
}

export function bindRoomEvents(
	room: Room,
	attemptId: number,
	guildId: string | null,
	channelId: string,
	callbacks: RoomEventCallbacks,
): void {
	const guard = VoiceConnectionManager.createGuardedHandler.bind(VoiceConnectionManager);

	room.on(
		RoomEvent.Connected,
		guard(attemptId, async () => {
			VoiceParticipantManager.hydrateFromRoom(room);
			VoicePermissionManager.applyDeafen(room, LocalVoiceStateStore.getSelfDeaf());
			VoiceConnectionManager.markConnected();
			await callbacks.onConnected();
			await VoiceMediaManager.playEntranceSound();
			await VoiceMediaManager.ensureMicrophone(room, channelId);
			if (guildId && channelId) {
				VoicePermissionManager.syncWithPermissionStore(guildId, channelId, room);
			}
			VoiceMediaManager.applyAllLocalAudioPreferences(room);
		}),
	);

	room.on(
		RoomEvent.Disconnected,
		guard(attemptId, () => {
			VoiceMediaStateCoordinator.resetLocalMediaState('room_disconnect');
			VoiceMediaManager.resetStreamTracking();
			callbacks.onDisconnected();
			VoiceParticipantManager.clear();
			VoiceConnectionManager.markDisconnected('error');
		}),
	);

	room.on(
		RoomEvent.Reconnecting,
		guard(attemptId, () => {
			callbacks.onReconnecting();
			VoiceConnectionManager.markReconnecting();
		}),
	);

	room.on(
		RoomEvent.Reconnected,
		guard(attemptId, () => {
			VoiceParticipantManager.hydrateFromRoom(room);
			VoicePermissionManager.applyDeafen(room, LocalVoiceStateStore.getSelfDeaf());
			VoiceConnectionManager.markReconnected();
			callbacks.onReconnected();
			VoiceMediaManager.applyAllLocalAudioPreferences(room);
		}),
	);

	room.on(
		RoomEvent.ParticipantConnected,
		guard(attemptId, (p: Participant) => {
			VoiceParticipantManager.upsertParticipant(p);
			if (p.identity.startsWith('user_')) {
				SoundActionCreators.playSound(SoundType.UserJoin);
			} else {
				SoundActionCreators.playSound(SoundType.ViewerJoin);
			}
		}),
	);

	room.on(
		RoomEvent.ParticipantDisconnected,
		guard(attemptId, (p: Participant) => {
			VoiceParticipantManager.removeParticipant(p.identity);
			if (VoiceConnectionManager.disconnecting) return;
			if (p.identity === room.localParticipant?.identity) return;
			if (p.identity.startsWith('user_')) {
				SoundActionCreators.playSound(SoundType.UserLeave);
			} else {
				SoundActionCreators.playSound(SoundType.ViewerLeave);
			}
		}),
	);

	room.on(
		RoomEvent.TrackSubscribed,
		guard(attemptId, (_track, pub, participant: Participant) => {
			try {
				logger.debug('Track subscribed', {
					participantIdentity: participant.identity,
					source: pub.source,
					trackSid: pub.trackSid,
					isSubscribed: pub.isSubscribed,
					isScreenShareAudio: pub.source === Track.Source.ScreenShareAudio,
				});
				if (pub.kind === Track.Kind.Audio) {
					ParticipantVolumeStore.applySettingsToParticipant(
						participant as RemoteParticipant,
						LocalVoiceStateStore.getSelfDeaf(),
					);
				}
			} catch {}
			VoiceParticipantManager.upsertParticipant(participant);
		}),
	);

	room.on(
		RoomEvent.TrackUnsubscribed,
		guard(attemptId, (_t, _pub, p: Participant) => VoiceParticipantManager.upsertParticipant(p)),
	);

	room.on(
		RoomEvent.TrackMuted,
		guard(attemptId, (_pub, p: Participant) => VoiceParticipantManager.upsertParticipant(p)),
	);

	room.on(
		RoomEvent.TrackUnmuted,
		guard(attemptId, (_pub, p: Participant) => VoiceParticipantManager.upsertParticipant(p)),
	);

	room.on(
		RoomEvent.ParticipantMetadataChanged,
		guard(attemptId, (_m, p: Participant) => VoiceParticipantManager.upsertParticipant(p)),
	);

	room.on(
		RoomEvent.ParticipantAttributesChanged,
		guard(attemptId, (_a, p: Participant) => VoiceParticipantManager.upsertParticipant(p)),
	);

	room.on(
		RoomEvent.ParticipantNameChanged,
		guard(attemptId, (_n, p: Participant) => VoiceParticipantManager.upsertParticipant(p)),
	);

	room.on(
		RoomEvent.ConnectionQualityChanged,
		guard(attemptId, (_q, p: Participant) => VoiceParticipantManager.upsertParticipant(p)),
	);

	room.on(
		RoomEvent.LocalTrackPublished,
		guard(attemptId, (pub, p: Participant) => {
			if (p.isLocal) {
				VoiceMediaStateCoordinator.handleLocalTrackStateChange(pub.source, true);
			}
			VoiceParticipantManager.upsertParticipant(p);
		}),
	);

	room.on(
		RoomEvent.LocalTrackUnpublished,
		guard(attemptId, (pub, p: Participant) => {
			if (p.isLocal) {
				VoiceMediaStateCoordinator.handleLocalTrackStateChange(pub.source, false);
			}
			VoiceParticipantManager.upsertParticipant(p);
		}),
	);

	room.on(
		RoomEvent.ActiveSpeakersChanged,
		guard(attemptId, (speakers: Array<Participant>) => VoiceParticipantManager.updateActiveSpeakers(speakers)),
	);

	room.on(
		RoomEvent.TrackPublished,
		guard(attemptId, (pub) => {
			try {
				logger.debug('Track published', {
					source: pub.source,
					trackSid: pub.trackSid,
				});
				if (pub.source === Track.Source.Microphone) {
					pub.setSubscribed(!LocalVoiceStateStore.getSelfDeaf());
					return;
				}
				if (
					pub.source === Track.Source.Camera ||
					pub.source === Track.Source.ScreenShare ||
					pub.source === Track.Source.ScreenShareAudio
				) {
					pub.setSubscribed(false);
				}
			} catch {}
		}),
	);
}
