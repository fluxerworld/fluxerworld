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
import * as SoundUtils from '@app/utils/SoundUtils';
import {SoundType} from '@app/utils/SoundUtils';
import {makeAutoObservable, runInAction} from 'mobx';

export interface SoundSettings {
	allSoundsDisabled: boolean;
	disabledSounds: Partial<Record<SoundType, boolean>>;
}

class SoundStore {
	private logger = new Logger('SoundStore');
	private inFlightLoopSounds = new Set<SoundType>();
	private pendingLoopSounds = new Set<SoundType>();
	private loopPlayTokens = new Map<SoundType, number>();
	private unlockListenersAttached = false;
	currentlyPlaying = new Set<SoundType>();
	volume = 0.7;
	incomingCallActive = false;
	settings: SoundSettings = {
		allSoundsDisabled: false,
		disabledSounds: {},
	};

	constructor() {
		makeAutoObservable<
			SoundStore,
			'inFlightLoopSounds' | 'pendingLoopSounds' | 'loopPlayTokens' | 'unlockListenersAttached'
		>(
			this,
			{
				currentlyPlaying: false,
				inFlightLoopSounds: false,
				pendingLoopSounds: false,
				loopPlayTokens: false,
				unlockListenersAttached: false,
			},
			{autoBind: true},
		);
		this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'SoundStore', ['settings'], {version: 3});
	}

	playSound(sound: SoundType, loop = false): void {
		if (!this.isSoundEnabled(sound)) {
			return;
		}

		if (loop) {
			if (this.isPlayingSound(sound) || this.inFlightLoopSounds.has(sound) || this.pendingLoopSounds.has(sound)) {
				return;
			}
			this.inFlightLoopSounds.add(sound);
		}

		const token = loop ? this.bumpLoopToken(sound) : 0;

		SoundUtils.playSound(sound, loop, this.volume, () => {
			if (loop) {
				this.queuePendingLoopSound(sound);
			}
		})
			.then((result) => {
				if (loop) {
					this.inFlightLoopSounds.delete(sound);
				}
				if (result) {
					if (loop && this.getLoopToken(sound) !== token) {
						void SoundUtils.stopSound(sound);
						return;
					}
					this.clearPendingLoopSound(sound);
					runInAction(() => {
						const newPlaying = new Set(this.currentlyPlaying);
						newPlaying.add(sound);
						this.currentlyPlaying = newPlaying;
					});
				}
			})
			.catch((error) => {
				if (loop) {
					this.inFlightLoopSounds.delete(sound);
				}
				this.logger.warn('Failed to play sound:', error);
			});
	}

	stopSound(sound: SoundType): void {
		this.bumpLoopToken(sound);
		this.inFlightLoopSounds.delete(sound);
		this.clearPendingLoopSound(sound);
		SoundUtils.stopSound(sound);
		const newPlaying = new Set(this.currentlyPlaying);
		newPlaying.delete(sound);
		this.currentlyPlaying = newPlaying;
	}

	stopAllSounds(): void {
		this.clearPendingLoopSounds();
		this.inFlightLoopSounds.clear();
		this.loopPlayTokens.clear();
		SoundUtils.stopAllSounds();
		this.currentlyPlaying = new Set();
		this.incomingCallActive = false;
	}

	startIncomingRing(): void {
		this.incomingCallActive = true;
		if (this.isPlayingSound(SoundType.IncomingRing) || this.inFlightLoopSounds.has(SoundType.IncomingRing)) {
			return;
		}
		if (this.pendingLoopSounds.has(SoundType.IncomingRing)) {
			return;
		}
		this.playSound(SoundType.IncomingRing, true);
	}

	stopIncomingRing(): void {
		this.stopSound(SoundType.IncomingRing);
		this.incomingCallActive = false;
	}

	private isSoundEnabled(soundType: SoundType): boolean {
		return !this.settings.allSoundsDisabled && !this.settings.disabledSounds[soundType];
	}

	toggleEnabled(): void {
		this.settings = {
			...this.settings,
			allSoundsDisabled: !this.settings.allSoundsDisabled,
		};
		if (this.settings.allSoundsDisabled) {
			this.stopAllSounds();
		}
	}

	updateSettings(settings: {allSoundsDisabled?: boolean; soundType?: SoundType; enabled?: boolean}): void {
		const {soundType, enabled, allSoundsDisabled} = settings;

		if (allSoundsDisabled !== undefined) {
			this.settings = {
				...this.settings,
				allSoundsDisabled,
			};
			if (allSoundsDisabled) {
				this.stopAllSounds();
			}
		} else if (soundType && enabled !== undefined) {
			const newDisabledSounds = {...this.settings.disabledSounds};
			if (enabled) {
				delete newDisabledSounds[soundType];
			} else {
				newDisabledSounds[soundType] = true;
			}

			this.settings = {
				...this.settings,
				disabledSounds: newDisabledSounds,
			};
			if (!enabled) {
				this.clearPendingLoopSound(soundType);
			}
		}
	}

	setVolume(volume: number): void {
		this.volume = Math.max(0, Math.min(1, volume));
	}

	getSoundEnabled(): boolean {
		return !this.settings.allSoundsDisabled;
	}

	getSoundSettings(): SoundSettings {
		return this.settings;
	}

	isSoundTypeEnabled(soundType: SoundType): boolean {
		return this.isSoundEnabled(soundType);
	}

	getVolume(): number {
		return this.volume;
	}

	isIncomingCallActive(): boolean {
		return this.incomingCallActive;
	}

	isPlayingSound(sound: SoundType): boolean {
		return this.currentlyPlaying.has(sound);
	}

	private bumpLoopToken(sound: SoundType): number {
		const nextToken = (this.loopPlayTokens.get(sound) ?? 0) + 1;
		this.loopPlayTokens.set(sound, nextToken);
		return nextToken;
	}

	private getLoopToken(sound: SoundType): number {
		return this.loopPlayTokens.get(sound) ?? 0;
	}

	private queuePendingLoopSound(sound: SoundType): void {
		if (this.pendingLoopSounds.has(sound)) {
			return;
		}
		this.pendingLoopSounds.add(sound);
		this.attachUnlockListeners();
	}

	private clearPendingLoopSound(sound: SoundType): void {
		if (this.pendingLoopSounds.delete(sound)) {
			this.detachUnlockListenersIfIdle();
		}
	}

	private clearPendingLoopSounds(): void {
		this.pendingLoopSounds.clear();
		this.detachUnlockListeners();
	}

	private attachUnlockListeners(): void {
		if (this.unlockListenersAttached) {
			return;
		}
		this.unlockListenersAttached = true;
		window.addEventListener('pointerdown', this.handleAutoplayUnlock, {passive: true});
		window.addEventListener('keydown', this.handleAutoplayUnlock);
	}

	private detachUnlockListenersIfIdle(): void {
		if (this.pendingLoopSounds.size > 0) {
			return;
		}
		this.detachUnlockListeners();
	}

	private detachUnlockListeners(): void {
		if (!this.unlockListenersAttached) {
			return;
		}
		window.removeEventListener('pointerdown', this.handleAutoplayUnlock);
		window.removeEventListener('keydown', this.handleAutoplayUnlock);
		this.unlockListenersAttached = false;
	}

	private handleAutoplayUnlock(): void {
		this.retryPendingLoopSounds();
	}

	private retryPendingLoopSounds(): void {
		if (this.pendingLoopSounds.size === 0) {
			this.detachUnlockListeners();
			return;
		}

		for (const sound of Array.from(this.pendingLoopSounds)) {
			if (!this.isSoundEnabled(sound)) {
				this.pendingLoopSounds.delete(sound);
				continue;
			}
			if (sound === SoundType.IncomingRing && !this.incomingCallActive) {
				this.pendingLoopSounds.delete(sound);
				continue;
			}
			if (this.isPlayingSound(sound) || this.inFlightLoopSounds.has(sound)) {
				this.pendingLoopSounds.delete(sound);
				continue;
			}
			this.pendingLoopSounds.delete(sound);
			this.playSound(sound, true);
		}

		this.detachUnlockListenersIfIdle();
	}
}

export default new SoundStore();
