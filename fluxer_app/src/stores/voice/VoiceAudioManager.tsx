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
import KeybindStore from '@app/stores/KeybindStore';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import ParticipantVolumeStore from '@app/stores/ParticipantVolumeStore';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import type {LocalTrackPublication, Room} from 'livekit-client';

const logger = new Logger('VoiceAudioManager');

const extractUserId = (identity: string): string | null => {
	const match = identity.match(/^user_(\d+)(?:_(.+))?$/);
	return match ? match[1] : null;
};

export function applyLocalAudioPreferencesForUser(userId: string, room: Room | null): void {
	if (!room) {
		logger.warn('No room');
		return;
	}

	const selfDeaf = LocalVoiceStateStore.getSelfDeaf();

	room.remoteParticipants.forEach((p) => {
		if (extractUserId(p.identity) !== userId) return;
		try {
			ParticipantVolumeStore.applySettingsToParticipant(p, selfDeaf);
		} catch (error) {
			logger.warn(`Failed to apply audio preferences for user ${userId}`, {error});
		}
	});
}

export function applyAllLocalAudioPreferences(room: Room | null): void {
	if (!room) {
		logger.warn('No room');
		return;
	}

	const selfDeaf = LocalVoiceStateStore.getSelfDeaf();
	ParticipantVolumeStore.applySettingsToRoom(room, selfDeaf);
}

export function applyPushToTalkHold(
	held: boolean,
	room: Room | null,
	getCurrentUserVoiceState: () => VoiceState | null,
	syncVoiceState: (partial: {self_mute?: boolean}) => void,
): void {
	KeybindStore.setPushToTalkHeld(held);
	if (!KeybindStore.isPushToTalkEnabled()) return;

	const serverVoiceState = getCurrentUserVoiceState();
	if (serverVoiceState?.mute) return;

	const userMuted = LocalVoiceStateStore.getHasUserSetMute() && LocalVoiceStateStore.getSelfMute();
	const shouldMute = userMuted || !held;

	applyLocalMuteState(shouldMute, room, syncVoiceState);
}

export function handlePushToTalkModeChange(
	room: Room | null,
	getCurrentUserVoiceState: () => VoiceState | null,
	syncVoiceState: (partial: {self_mute?: boolean}) => void,
): void {
	const serverVoiceState = getCurrentUserVoiceState();
	if (serverVoiceState?.mute) return;

	if (KeybindStore.isPushToTalkEffective()) {
		KeybindStore.setPushToTalkHeld(false);
		KeybindStore.resetPushToTalkState();
		if (!LocalVoiceStateStore.getHasUserSetMute()) {
			applyLocalMuteState(true, room, syncVoiceState);
		}
	} else if (!LocalVoiceStateStore.getHasUserSetMute()) {
		applyLocalMuteState(false, room, syncVoiceState);
	}
}

export function getMuteReason(voiceState: VoiceState | null): 'guild' | 'push_to_talk' | 'self' | null {
	const isGuildMuted = voiceState?.mute ?? false;
	if (isGuildMuted) return 'guild';

	const selfMuted = voiceState?.self_mute ?? LocalVoiceStateStore.getSelfMute();
	if (KeybindStore.isPushToTalkEffective() && KeybindStore.isPushToTalkMuted(selfMuted)) return 'push_to_talk';
	if (selfMuted) return 'self';
	return null;
}

export function applyLocalMuteState(
	muted: boolean,
	room: Room | null,
	syncVoiceState: (partial: {self_mute?: boolean}) => void,
): void {
	const targetMute = LocalVoiceStateStore.getSelfDeaf() ? true : muted;
	const currentMute = LocalVoiceStateStore.getSelfMute();

	if (currentMute === targetMute) {
		return;
	}

	if (room?.localParticipant) {
		const hasAudioTracks = room.localParticipant.audioTrackPublications.size > 0;

		if (!targetMute && !hasAudioTracks) {
			logger.debug('Skipping unmute: no audio tracks exist. Enable microphone first.');
			syncVoiceState({self_mute: true});
			return;
		}

		room.localParticipant.audioTrackPublications.forEach((publication: LocalTrackPublication) => {
			const operation = targetMute ? publication.mute() : publication.unmute();
			operation.catch((error) =>
				logger.error(targetMute ? 'Failed to mute publication' : 'Failed to unmute publication', {error}),
			);
		});
	}

	LocalVoiceStateStore.updateSelfMute(targetMute);
	syncVoiceState({self_mute: targetMute});
}
