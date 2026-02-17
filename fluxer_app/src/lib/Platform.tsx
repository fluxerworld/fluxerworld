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

const userAgent = navigator.userAgent;
const isIOSDevice = /iPad|iPhone|iPod/i.test(userAgent);
const isAndroidDevice = /Android/i.test(userAgent);
const isElectron = (window as {electron?: unknown}).electron !== undefined;
const isIOSWeb = isIOSDevice && !isElectron;
const isPWA =
	window.matchMedia?.('(display-mode: standalone)').matches ||
	(navigator as {standalone?: boolean}).standalone === true;
const isMobileBrowser = isIOSDevice || isAndroidDevice;

type PlatformSelector<T> = {
	web?: T;
	ios?: T;
	android?: T;
	electron?: T;
	default?: T;
};

function selectValue<T>(options: PlatformSelector<T>): T | undefined {
	if (isElectron && options.electron !== undefined) {
		return options.electron;
	}
	if (isIOSDevice && options.ios !== undefined) {
		return options.ios;
	}
	if (isAndroidDevice && options.android !== undefined) {
		return options.android;
	}
	if (options.web !== undefined) {
		return options.web;
	}
	return options.default;
}

export const Platform = {
	OS: 'web' as const,
	isWeb: true,
	isIOS: isIOSDevice,
	isAndroid: isAndroidDevice,
	isElectron,
	isIOSWeb,
	isPWA,
	isAppleDevice: isIOSDevice,
	isMobileBrowser,
	select: selectValue,
};

export function isWebPlatform(): boolean {
	return Platform.isWeb;
}

export function isElectronPlatform(): boolean {
	return Platform.isElectron;
}

export function getNativeLocaleIdentifier(): string | null {
	const languages = navigator.languages;
	if (Array.isArray(languages) && languages.length > 0) {
		return languages[0];
	}
	return navigator.language ?? null;
}
