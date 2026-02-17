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
import {syncVoiceStateToServer} from '@app/stores/voice/VoiceChannelConnector';

export interface VoiceStateSyncPayload {
	guild_id: string | null;
	channel_id: string;
	connection_id: string;
	self_mute: boolean;
	self_deaf: boolean;
	self_video: boolean;
	self_stream: boolean;
	viewer_stream_keys: Array<string>;
}

const logger = new Logger('VoiceStateSyncManager');

export class VoiceStateSyncManager {
	private pending: VoiceStateSyncPayload | null = null;
	private lastSent: VoiceStateSyncPayload | null = null;
	private inFlight: VoiceStateSyncPayload | null = null;
	private serverState: VoiceStateSyncPayload | null = null;
	private flushScheduled = false;

	reset(): void {
		this.pending = null;
		this.lastSent = null;
		this.inFlight = null;
		this.serverState = null;
		this.flushScheduled = false;
		logger.debug('Voice state sync cache cleared');
	}

	requestState(payload: VoiceStateSyncPayload): void {
		this.pending = payload;
		this.scheduleFlush();
	}

	confirmServerState(payload: VoiceStateSyncPayload | null): void {
		if (!payload) {
			this.serverState = null;
			return;
		}

		this.serverState = payload;
		if (this.inFlight && this.areEqual(this.inFlight, payload)) {
			this.inFlight = null;
			this.lastSent = payload;
		}

		if (this.pending && this.areEqual(this.pending, payload)) {
			this.pending = null;
		}

		this.scheduleFlush();
	}

	private scheduleFlush(): void {
		if (this.flushScheduled) return;
		this.flushScheduled = true;

		Promise.resolve().then(() => {
			this.flushScheduled = false;
			this.flush();
		});
	}

	private flush(): void {
		if (!this.pending) return;

		if (
			this.inFlight &&
			(this.inFlight.connection_id !== this.pending.connection_id ||
				this.inFlight.channel_id !== this.pending.channel_id ||
				this.inFlight.guild_id !== this.pending.guild_id)
		) {
			logger.debug('Dropping stale in-flight state after context change', {
				inFlight: this.inFlight,
				pending: this.pending,
			});
			this.inFlight = null;
		}

		if (this.inFlight) return;

		if (this.lastSent && this.areEqual(this.lastSent, this.pending)) {
			this.pending = null;
			return;
		}

		if (this.serverState && this.areEqual(this.serverState, this.pending)) {
			this.pending = null;
			this.lastSent = this.serverState;
			return;
		}

		logger.debug('Sending voice state update to server', this.pending);
		syncVoiceStateToServer(this.pending.guild_id, this.pending.channel_id, this.pending.connection_id, {
			self_mute: this.pending.self_mute,
			self_deaf: this.pending.self_deaf,
			self_video: this.pending.self_video,
			self_stream: this.pending.self_stream,
			viewer_stream_keys: this.pending.viewer_stream_keys,
		});

		this.lastSent = this.pending;
		this.inFlight = this.pending;
		this.pending = null;
	}

	private areEqual(a: VoiceStateSyncPayload, b: VoiceStateSyncPayload): boolean {
		return (
			a.guild_id === b.guild_id &&
			a.channel_id === b.channel_id &&
			a.connection_id === b.connection_id &&
			a.self_mute === b.self_mute &&
			a.self_deaf === b.self_deaf &&
			a.self_video === b.self_video &&
			a.self_stream === b.self_stream &&
			JSON.stringify(a.viewer_stream_keys) === JSON.stringify(b.viewer_stream_keys)
		);
	}
}
