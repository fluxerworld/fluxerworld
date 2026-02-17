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
import AccessibilityStore from '@app/stores/AccessibilityStore';
import UserSettingsStore, {type UserSettings} from '@app/stores/UserSettingsStore';
import {StickerAnimationOptions} from '@fluxer/constants/src/UserConstants';
import {makeAutoObservable, reaction, runInAction} from 'mobx';

const logger = new Logger('AccessibilityOverrideStore');

export type AnimationOverrides = Readonly<{
	gifAutoPlayDirty: boolean;
	animateEmojiDirty: boolean;
	animateStickersDirty: boolean;
}>;

class AccessibilityOverrideStore {
	gifAutoPlayDirty = false;
	animateEmojiDirty = false;
	animateStickersDirty = false;

	private overrideTimeout: number | null = null;
	private initialized = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		this.initPersistence();
		this.bindToAccessibilityStore();
		setTimeout(() => {
			runInAction(() => {
				this.initialized = true;
				logger.debug('AccessibilityOverrideStore initialized');
				if (AccessibilityStore.useReducedMotion && UserSettingsStore.isHydrated()) {
					this.applyReducedMotionOverrides();
				}
			});
		}, 1000);
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'AccessibilityOverrideStore', [
			'gifAutoPlayDirty',
			'animateEmojiDirty',
			'animateStickersDirty',
		]);
	}

	private bindToAccessibilityStore(): void {
		reaction(
			() => AccessibilityStore.useReducedMotion,
			(isReducedMotion, previous) => {
				if (previous === false && isReducedMotion) {
					this.scheduleReducedMotionOverrides();
				}
			},
			{fireImmediately: false},
		);
	}

	private scheduleReducedMotionOverrides(): void {
		const schedule = () => {
			if (this.overrideTimeout != null) {
				clearTimeout(this.overrideTimeout);
			}
			this.overrideTimeout = window.setTimeout(() => {
				this.applyReducedMotionOverrides();
				this.overrideTimeout = null;
			}, 50);
		};

		schedule();
		window.setTimeout(schedule, 0);
		window.setTimeout(schedule, 10);
	}

	private applyReducedMotionOverrides(): void {
		if (!UserSettingsStore.isHydrated()) {
			logger.debug('Skipping reduced motion overrides before user settings hydration');
			return;
		}

		if (!this.initialized) {
			logger.debug('Skipping reduced motion overrides during initialization');
			return;
		}

		const updates: Partial<UserSettings> = {};
		const {gifAutoPlay, animateEmoji, animateStickers} = UserSettingsStore;

		if (!this.gifAutoPlayDirty && gifAutoPlay) {
			updates.gifAutoPlay = false;
		}

		if (!this.animateEmojiDirty && animateEmoji) {
			updates.animateEmoji = false;
		}

		if (!this.animateStickersDirty && animateStickers === StickerAnimationOptions.ALWAYS_ANIMATE) {
			updates.animateStickers = StickerAnimationOptions.ANIMATE_ON_INTERACTION;
		}

		if (Object.keys(updates).length > 0) {
			void UserSettingsStore.saveSettings(updates).catch((error) => {
				logger.error('Failed to apply reduced motion overrides', error);
			});
		}

		this.gifAutoPlayDirty = false;
		this.animateEmojiDirty = false;
		this.animateStickersDirty = false;
		logger.debug('Applied reduced motion overrides');
	}

	updateUserSettings(userSettings: unknown): void {
		if (!this.initialized) {
			logger.debug('Skipping updateUserSettings during initialization');
			return;
		}

		const currentUserSettings = UserSettingsStore;
		const isReducedMotion = AccessibilityStore.useReducedMotion;

		if (!isReducedMotion) return;

		if (!isRecord(userSettings)) {
			return;
		}

		const gifAutoPlayValue = userSettings.gif_auto_play;
		const animateEmojiValue = userSettings.animate_emoji;
		const animateStickersValue = userSettings.animate_stickers;

		if (typeof gifAutoPlayValue === 'boolean' && gifAutoPlayValue !== currentUserSettings.gifAutoPlay) {
			this.gifAutoPlayDirty = true;
			logger.debug('Marked gifAutoPlay as dirty');
		}
		if (typeof animateEmojiValue === 'boolean' && animateEmojiValue !== currentUserSettings.animateEmoji) {
			this.animateEmojiDirty = true;
			logger.debug('Marked animateEmoji as dirty');
		}
		if (typeof animateStickersValue === 'number' && animateStickersValue !== currentUserSettings.animateStickers) {
			this.animateStickersDirty = true;
			logger.debug('Marked animateStickers as dirty');
		}

		this.applyReducedMotionOverrides();
	}

	markDirty(setting: keyof AnimationOverrides): void {
		this[setting] = true;
		logger.debug(`Marked ${setting} as dirty`);
	}

	isOverriddenByReducedMotion(setting: 'gif_auto_play' | 'animate_emoji' | 'animate_stickers'): boolean {
		const isReducedMotion = AccessibilityStore.useReducedMotion;
		if (!isReducedMotion) return false;

		switch (setting) {
			case 'gif_auto_play':
				return !this.gifAutoPlayDirty;
			case 'animate_emoji':
				return !this.animateEmojiDirty;
			case 'animate_stickers':
				return !this.animateStickersDirty;
			default:
				return false;
		}
	}

	get effectiveGifAutoPlay(): boolean {
		if (this.isOverriddenByReducedMotion('gif_auto_play')) {
			return false;
		}
		return UserSettingsStore.getGifAutoPlay();
	}

	get effectiveAnimateEmoji(): boolean {
		if (this.isOverriddenByReducedMotion('animate_emoji')) {
			return false;
		}
		return UserSettingsStore.getAnimateEmoji();
	}

	get effectiveAnimateStickers(): number {
		if (this.isOverriddenByReducedMotion('animate_stickers')) {
			if (UserSettingsStore.getAnimateStickers() === StickerAnimationOptions.ALWAYS_ANIMATE) {
				return StickerAnimationOptions.ANIMATE_ON_INTERACTION;
			}
		}
		return UserSettingsStore.getAnimateStickers();
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export default new AccessibilityOverrideStore();
