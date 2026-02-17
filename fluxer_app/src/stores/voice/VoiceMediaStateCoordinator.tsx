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
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import VoiceConnectionManager from '@app/stores/voice/VoiceConnectionManager';
import {syncLocalVoiceStateWithServer} from '@app/stores/voice/VoiceMediaEngineBridge';
import {Track} from 'livekit-client';

type VoiceMediaSource = 'camera' | 'screen_share';

type VoiceMediaStateReason =
	| 'user'
	| 'server'
	| 'track_event'
	| 'disconnect'
	| 'room_disconnect'
	| 'cleanup'
	| 'logout';

interface VoiceMediaStateOptions {
	sendUpdate?: boolean;
	reason: VoiceMediaStateReason;
}

const logger = new Logger('VoiceMediaStateCoordinator');

class VoiceMediaStateCoordinator {
	private suppressNextSync: Record<VoiceMediaSource, boolean> = {
		camera: false,
		screen_share: false,
	};

	applyCameraState(enabled: boolean, options: VoiceMediaStateOptions): void {
		this.applyRequestedState('camera', enabled, options);
	}

	applyScreenShareState(enabled: boolean, options: VoiceMediaStateOptions): void {
		this.applyRequestedState('screen_share', enabled, options);
	}

	handleLocalTrackStateChange(source: Track.Source, isPublished: boolean): void {
		const mapped = this.mapSource(source);
		if (!mapped) return;

		const suppressed = this.consumeSuppression(mapped);
		const changed = this.updateLocalState(mapped, isPublished);

		if (suppressed || !changed) {
			if (suppressed) {
				logger.debug('Suppressed local track sync', {source: mapped, isPublished});
			}
			return;
		}

		this.syncState(mapped, isPublished);
	}

	resetLocalMediaState(reason: VoiceMediaStateReason): void {
		const suppress =
			reason === 'disconnect' || reason === 'room_disconnect' || reason === 'cleanup' || reason === 'logout';
		this.suppressNextSync.camera = suppress;
		this.suppressNextSync.screen_share = suppress;

		this.applyRequestedState('camera', false, {reason, sendUpdate: false});
		this.applyRequestedState('screen_share', false, {reason, sendUpdate: false});
	}

	private applyRequestedState(source: VoiceMediaSource, enabled: boolean, options: VoiceMediaStateOptions): void {
		const {sendUpdate = true, reason} = options;

		if (reason === 'user') {
			this.suppressNextSync[source] = false;
		}

		if (!sendUpdate) {
			this.suppressNextSync[source] = true;
		}

		const changed = this.updateLocalState(source, enabled);
		if (!sendUpdate || !changed) return;

		this.syncState(source, enabled);
	}

	private updateLocalState(source: VoiceMediaSource, enabled: boolean): boolean {
		if (source === 'camera') {
			const current = LocalVoiceStateStore.getSelfVideo();
			if (current === enabled) return false;
			LocalVoiceStateStore.updateSelfVideo(enabled);
			return true;
		}

		const current = LocalVoiceStateStore.getSelfStream();
		if (current === enabled) return false;
		LocalVoiceStateStore.updateSelfStream(enabled);
		return true;
	}

	private syncState(source: VoiceMediaSource, enabled: boolean): void {
		if (!this.canSync()) return;

		if (source === 'camera') {
			syncLocalVoiceStateWithServer({self_video: enabled});
			return;
		}

		syncLocalVoiceStateWithServer({self_stream: enabled});
	}

	private canSync(): boolean {
		if (VoiceConnectionManager.disconnecting) return false;
		const {channelId, connectionId} = VoiceConnectionManager.connectionState;
		return Boolean(channelId && connectionId);
	}

	private mapSource(source: Track.Source): VoiceMediaSource | null {
		if (source === Track.Source.Camera) return 'camera';
		if (source === Track.Source.ScreenShare) return 'screen_share';
		return null;
	}

	private consumeSuppression(source: VoiceMediaSource): boolean {
		if (!this.suppressNextSync[source]) return false;
		this.suppressNextSync[source] = false;
		return true;
	}
}

export default new VoiceMediaStateCoordinator();
