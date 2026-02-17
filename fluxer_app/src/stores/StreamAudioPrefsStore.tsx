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
import {makePersistent} from '@app/lib/MobXPersistence';
import {clampVoiceVolumePercent} from '@app/utils/VoiceVolumeUtils';
import {STREAM_AUDIO_PREFS_PRUNE_INTERVAL_MS, STREAM_AUDIO_PREFS_TTL_MS} from '@fluxer/constants/src/StreamConstants';
import {makeAutoObservable} from 'mobx';

const logger = new Logger('StreamAudioPrefsStore');

interface StreamAudioPrefsEntry {
	volume: number;
	muted: boolean;
	lastAccessed: number;
}

class StreamAudioPrefsStore {
	entries: Record<string, StreamAudioPrefsEntry> = {};
	private pruneIntervalId: number | null = null;

	constructor() {
		makeAutoObservable<this, 'pruneIntervalId'>(
			this,
			{pruneIntervalId: false, hasEntry: false, getVolume: false, isMuted: false},
			{autoBind: true},
		);
		void this.initPersistence();
		this.startPruneInterval();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'StreamAudioPrefsStore', ['entries']);
	}

	hasEntry(streamKey: string): boolean {
		return streamKey in this.entries;
	}

	getVolume(streamKey: string): number {
		return clampVoiceVolumePercent(this.entries[streamKey]?.volume ?? 100);
	}

	isMuted(streamKey: string): boolean {
		return this.entries[streamKey]?.muted ?? false;
	}

	setVolume(streamKey: string, volume: number): void {
		const clamped = clampVoiceVolumePercent(volume);
		const existing = this.entries[streamKey];
		if (existing && existing.volume === clamped) {
			this.touchStream(streamKey);
			return;
		}

		this.entries = {
			...this.entries,
			[streamKey]: {
				volume: clamped,
				muted: existing?.muted ?? false,
				lastAccessed: Date.now(),
			},
		};
		logger.debug('Set stream volume', {streamKey, volume: clamped});
	}

	setMuted(streamKey: string, muted: boolean): void {
		const existing = this.entries[streamKey];
		if (existing && existing.muted === muted) {
			this.touchStream(streamKey);
			return;
		}

		this.entries = {
			...this.entries,
			[streamKey]: {
				volume: existing?.volume ?? 100,
				muted,
				lastAccessed: Date.now(),
			},
		};
		logger.debug('Set stream mute', {streamKey, muted});
	}

	touchStream(streamKey: string): void {
		const existing = this.entries[streamKey];
		if (!existing) return;
		const now = Date.now();
		if (existing.lastAccessed === now) return;

		this.entries = {
			...this.entries,
			[streamKey]: {
				...existing,
				lastAccessed: now,
			},
		};
	}

	private startPruneInterval(): void {
		if (this.pruneIntervalId != null) {
			return;
		}

		this.pruneIntervalId = window.setInterval(() => {
			this.pruneExpiredEntries();
		}, STREAM_AUDIO_PREFS_PRUNE_INTERVAL_MS);
	}

	private pruneExpiredEntries(): void {
		const cutoff = Date.now() - STREAM_AUDIO_PREFS_TTL_MS;
		const nextEntries = {...this.entries};
		let removedCount = 0;

		for (const [streamKey, entry] of Object.entries(this.entries)) {
			if (entry.lastAccessed < cutoff) {
				delete nextEntries[streamKey];
				removedCount += 1;
			}
		}

		if (removedCount > 0) {
			this.entries = nextEntries;
			logger.debug('Pruned stream audio prefs', {removedCount});
		}
	}
}

export default new StreamAudioPrefsStore();
