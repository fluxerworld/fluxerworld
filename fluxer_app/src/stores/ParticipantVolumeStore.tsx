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

import {getStreamKey} from '@app/components/voice/StreamKeys';
import {Logger} from '@app/lib/Logger';
import {makePersistent} from '@app/lib/MobXPersistence';
import StreamAudioPrefsStore from '@app/stores/StreamAudioPrefsStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import VoiceConnectionManager from '@app/stores/voice/VoiceConnectionManager';
import {clampVoiceVolumePercent, voiceVolumePercentToTrackVolume} from '@app/utils/VoiceVolumeUtils';
import type {RemoteAudioTrack, RemoteParticipant, Room} from 'livekit-client';
import {Track} from 'livekit-client';
import {makeAutoObservable} from 'mobx';

const logger = new Logger('ParticipantVolumeStore');

const isRemoteAudioTrack = (track: Track | null | undefined): track is RemoteAudioTrack =>
	track?.kind === Track.Kind.Audio;

const idUser = (identity: string): string | null => {
	const m = identity.match(/^user_(\d+)(?:_(.+))?$/);
	return m ? m[1] : null;
};

const idConnection = (identity: string): string | null => {
	const match = identity.match(/^user_(\d+)_(.+)$/);
	return match ? match[2] : null;
};

function composeVolumePercent(...volumeParts: Array<number>): number {
	const composed = volumeParts.reduce((accumulator, currentValue) => {
		return accumulator * (clampVoiceVolumePercent(currentValue) / 100);
	}, 100);
	return clampVoiceVolumePercent(composed);
}

class ParticipantVolumeStore {
	volumes: Record<string, number> = {};
	localMutes: Record<string, boolean> = {};
	connectionVolumesByLocalConnectionId: Record<string, Record<string, number>> = {};

	constructor() {
		makeAutoObservable(
			this,
			{
				getVolume: false,
				isLocalMuted: false,
				getConnectionVolume: false,
			},
			{autoBind: true},
		);
		void this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'ParticipantVolumeStore', ['volumes', 'localMutes']);
	}

	setVolume(userId: string, volume: number): void {
		const clamped = clampVoiceVolumePercent(volume);
		this.volumes = {
			...this.volumes,
			[userId]: clamped,
		};
		logger.debug(`Set volume for ${userId}: ${clamped}`);
	}

	setLocalMute(userId: string, muted: boolean): void {
		this.localMutes = {
			...this.localMutes,
			[userId]: muted,
		};
		logger.debug(`Set local mute for ${userId}: ${muted}`);
	}

	setConnectionVolume(connectionId: string, volume: number): void {
		const localConnectionId = VoiceConnectionManager.connectionId;
		if (!localConnectionId || !connectionId) {
			return;
		}
		const clamped = clampVoiceVolumePercent(volume);
		const existingBucket = this.connectionVolumesByLocalConnectionId[localConnectionId] ?? {};
		this.connectionVolumesByLocalConnectionId = {
			...this.connectionVolumesByLocalConnectionId,
			[localConnectionId]: {
				...existingBucket,
				[connectionId]: clamped,
			},
		};
		logger.debug(`Set connection volume for ${connectionId} from ${localConnectionId}: ${clamped}`);
	}

	getVolume(userId: string): number {
		return clampVoiceVolumePercent(this.volumes[userId] ?? 100);
	}

	getConnectionVolume(connectionId: string | null): number {
		if (!connectionId) {
			return 100;
		}
		const localConnectionId = VoiceConnectionManager.connectionId;
		if (!localConnectionId) {
			return 100;
		}
		const bucket = this.connectionVolumesByLocalConnectionId[localConnectionId];
		return clampVoiceVolumePercent(bucket?.[connectionId] ?? 100);
	}

	isLocalMuted(userId: string): boolean {
		return this.localMutes[userId] ?? false;
	}

	resetUserSettings(userId: string): void {
		const newVolumes = {...this.volumes};
		const newLocalMutes = {...this.localMutes};
		delete newVolumes[userId];
		delete newLocalMutes[userId];
		this.volumes = newVolumes;
		this.localMutes = newLocalMutes;
		logger.debug(`Reset settings for ${userId}`);
	}

	applySettingsToRoom(room: Room | null, selfDeaf: boolean): void {
		if (!room) return;

		room.remoteParticipants.forEach((participant) => {
			this.applySettingsToParticipant(participant, selfDeaf);
		});
	}

	applySettingsToParticipant(participant: RemoteParticipant, selfDeaf: boolean): void {
		const userId = idUser(participant.identity);
		if (!userId) return;

		const connectionId = idConnection(participant.identity);
		const streamKey = connectionId
			? getStreamKey(VoiceConnectionManager.guildId, VoiceConnectionManager.channelId, connectionId)
			: null;

		const userVolume = this.getVolume(userId);
		const connectionVolume = this.getConnectionVolume(connectionId);
		const outputVolume = VoiceSettingsStore.getOutputVolume();
		const locallyMuted = this.isLocalMuted(userId);

		participant.audioTrackPublications.forEach((pub) => {
			try {
				const isScreenShareAudio = pub.source === Track.Source.ScreenShareAudio;
				const streamVolume = streamKey ? StreamAudioPrefsStore.getVolume(streamKey) : 100;
				const streamMuted = streamKey ? StreamAudioPrefsStore.isMuted(streamKey) : false;
				const track = pub.track;
				if (isRemoteAudioTrack(track)) {
					const nextVolume = isScreenShareAudio
						? voiceVolumePercentToTrackVolume(composeVolumePercent(streamVolume, outputVolume))
						: voiceVolumePercentToTrackVolume(composeVolumePercent(userVolume, connectionVolume, outputVolume));
					track.setVolume(nextVolume);
				}

				const shouldDisable = locallyMuted || selfDeaf || (isScreenShareAudio && streamMuted);
				if (isScreenShareAudio) {
					logger.debug('Applying screen share audio prefs', {
						participantIdentity: participant.identity,
						trackSid: pub.trackSid,
						streamKey,
						streamVolume,
						streamMuted,
						locallyMuted,
						selfDeaf,
						shouldDisable,
					});
				}
				pub.setEnabled(!shouldDisable);

				if (isScreenShareAudio && streamKey && StreamAudioPrefsStore.hasEntry(streamKey)) {
					StreamAudioPrefsStore.touchStream(streamKey);
				}
			} catch (error) {
				logger.warn(`Failed to apply settings to participant ${userId}`, {error});
			}
		});
	}
}

export default new ParticipantVolumeStore();
