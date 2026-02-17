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

import {makePersistent} from '@app/lib/MobXPersistence';
import type {ThemeType} from '@fluxer/constants/src/UserConstants';
import {ThemeTypes} from '@fluxer/constants/src/UserConstants';
import {makeAutoObservable, reaction, runInAction} from 'mobx';

type ExplicitTheme = typeof ThemeTypes.DARK | typeof ThemeTypes.LIGHT | typeof ThemeTypes.COAL;
const EXPLICIT_THEMES = new Set<string>([ThemeTypes.DARK, ThemeTypes.LIGHT, ThemeTypes.COAL]);
const VALID_THEMES = new Set<string>(Object.values(ThemeTypes));
const STORAGE_KEY = 'theme';

function isExplicitTheme(theme: string | null | undefined): theme is ExplicitTheme {
	return typeof theme === 'string' && EXPLICIT_THEMES.has(theme);
}

function isValidTheme(theme: string | null | undefined): theme is ThemeType {
	return typeof theme === 'string' && VALID_THEMES.has(theme);
}

function loadThemeFromLocalStorage(): ExplicitTheme | null {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		return isExplicitTheme(stored) ? stored : null;
	} catch {
		return null;
	}
}

function persistThemeToLocalStorage(theme: string): void {
	try {
		if (isExplicitTheme(theme)) {
			window.localStorage.setItem(STORAGE_KEY, theme);
		}
	} catch {}
}

class ThemeStore {
	syncAcrossDevices = true;

	localTheme: ThemeType = ThemeTypes.DARK;

	serverTheme: ThemeType = ThemeTypes.DARK;

	systemPrefersDark = false;

	private _hydrated = false;
	private mediaQuery: MediaQueryList | null = null;
	private localStorageSyncDisposer: (() => void) | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		this.initSystemThemeDetection();
		this.initPersistence();
	}

	get isHydrated(): boolean {
		return this._hydrated;
	}

	get themePreference(): ThemeType {
		return this.syncAcrossDevices ? this.serverTheme : this.localTheme;
	}

	get effectiveTheme(): ExplicitTheme {
		if (!this._hydrated) {
			const earlyTheme = loadThemeFromLocalStorage();
			if (earlyTheme) {
				return earlyTheme;
			}
		}

		const preference = this.themePreference;
		if (preference === ThemeTypes.SYSTEM) {
			return this.systemPrefersDark ? ThemeTypes.DARK : ThemeTypes.LIGHT;
		}
		return preference;
	}

	setTheme(theme: ThemeType): void {
		if (!isValidTheme(theme)) {
			return;
		}

		if (theme === ThemeTypes.SYSTEM) {
			this.syncAcrossDevices = false;
			this.localTheme = theme;
			return;
		}

		if (this.syncAcrossDevices) {
			this.serverTheme = theme;
		} else {
			this.localTheme = theme;
		}
	}

	setSyncAcrossDevices(sync: boolean): void {
		if (sync === this.syncAcrossDevices) {
			return;
		}

		if (sync) {
			this.syncAcrossDevices = true;
			this.localTheme = ThemeTypes.DARK;
		} else {
			const currentTheme = this.effectiveTheme;
			this.syncAcrossDevices = false;
			this.localTheme = currentTheme;
		}
	}

	updateServerTheme(theme: string | null | undefined): void {
		const normalized = isValidTheme(theme) ? theme : ThemeTypes.DARK;
		this.serverTheme = normalized;
	}

	private initSystemThemeDetection(): void {
		if (!window.matchMedia) {
			return;
		}
		this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		this.systemPrefersDark = this.mediaQuery.matches;
		this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
	}

	private handleSystemThemeChange = (event: MediaQueryListEvent): void => {
		this.systemPrefersDark = event.matches;
	};

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'ThemeStore', ['syncAcrossDevices', 'localTheme']);

		runInAction(() => {
			this._hydrated = true;
		});

		this.localStorageSyncDisposer = reaction(
			() => this.effectiveTheme,
			(theme) => persistThemeToLocalStorage(theme),
			{fireImmediately: true},
		);
	}

	destroy(): void {
		if (this.mediaQuery) {
			this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
			this.mediaQuery = null;
		}
		if (this.localStorageSyncDisposer) {
			this.localStorageSyncDisposer();
			this.localStorageSyncDisposer = null;
		}
	}
}

export default new ThemeStore();
