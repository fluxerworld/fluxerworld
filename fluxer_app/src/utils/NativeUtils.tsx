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
import type {ElectronAPI} from '@app/types/electron.d';

const logger = new Logger('NativeUtils');

export function isElectron(): boolean {
	return (window as {electron?: ElectronAPI}).electron !== undefined;
}

export function getElectronAPI(): ElectronAPI | null {
	if (!isElectron()) return null;
	return (window as {electron?: ElectronAPI}).electron ?? null;
}

export function isDesktop(): boolean {
	return isElectron();
}

export type NativePlatform = 'macos' | 'windows' | 'linux' | 'unknown';

const normalizePlatform = (platform: string | null | undefined): NativePlatform => {
	const value = platform?.toLowerCase() ?? '';
	if (value.startsWith('mac')) return 'macos';
	if (value.startsWith('darwin')) return 'macos';
	if (value.startsWith('win')) return 'windows';
	if (value.includes('linux')) return 'linux';
	return 'unknown';
};

export function guessPlatform(): NativePlatform {
	const uaDataPlatform = (navigator as {userAgentData?: {platform?: string}}).userAgentData?.platform;
	if (uaDataPlatform) {
		return normalizePlatform(uaDataPlatform);
	}
	return normalizePlatform(navigator.platform);
}

export async function getNativePlatform(): Promise<NativePlatform> {
	const electronApi = getElectronAPI();
	if (electronApi) {
		switch (electronApi.platform) {
			case 'darwin':
				return 'macos';
			case 'win32':
				return 'windows';
			case 'linux':
				return 'linux';
			default:
				return 'unknown';
		}
	}

	return guessPlatform();
}

export function isNativeMacOS(platform?: NativePlatform) {
	return (platform ?? guessPlatform()) === 'macos';
}
export function isNativeWindows(platform?: NativePlatform) {
	return (platform ?? guessPlatform()) === 'windows';
}
export function isNativeLinux(platform?: NativePlatform) {
	return (platform ?? guessPlatform()) === 'linux';
}

export function supportsDesktopScreenShareAudioCapture(): boolean {
	const electronApi = getElectronAPI();
	if (!electronApi) {
		return true;
	}
	return electronApi.platform === 'win32';
}

let externalLinkHandlerAttached = false;

const isLikelyExternal = (href: string | null): href is string => {
	if (!href) return false;
	if (href.startsWith('javascript:')) return false;
	try {
		const url = new URL(href, window.location.href);
		const allowedProtocols = ['http:', 'https:', 'mailto:', 'x-apple.systempreferences:'];
		return allowedProtocols.includes(url.protocol);
	} catch {
		return false;
	}
};

export async function openExternalUrl(url: string, target: string = '_blank') {
	const electronApi = getElectronAPI();
	if (electronApi) {
		try {
			await electronApi.openExternal(url);
			return;
		} catch (error) {
			logger.error(' Failed to open via Electron, falling back', error);
		}
	}

	window.open(url, target, 'noopener,noreferrer');
}

export function attachExternalLinkInterceptor() {
	if (!isDesktop() || externalLinkHandlerAttached) return () => undefined;

	const handler = (event: MouseEvent) => {
		const target = event.target as HTMLElement | null;
		const anchor = target?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
		if (!anchor) return;

		const href = anchor.getAttribute('href');
		if (!isLikelyExternal(href)) return;

		event.preventDefault();
		void openExternalUrl(href ?? '');
	};

	document.addEventListener('click', handler);
	externalLinkHandlerAttached = true;

	return () => {
		document.removeEventListener('click', handler);
		externalLinkHandlerAttached = false;
	};
}

export async function downloadWithNative(options: {
	url: string;
	suggestedName?: string;
	title?: string;
}): Promise<boolean> {
	const electronApi = getElectronAPI();
	if (electronApi) {
		try {
			const result = await electronApi.downloadFile(options.url, options.suggestedName ?? 'download');
			return result.success;
		} catch (error) {
			logger.error(' Native download failed, falling back to browser', error);
			return false;
		}
	}

	return false;
}
