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

import type {AuthenticationResponseJSON, RegistrationResponseJSON} from '@simplewebauthn/browser';

export interface DesktopSource {
	id: string;
	name: string;
	thumbnailDataUrl: string;
	display_id?: string;
	appIconDataUrl?: string;
}

export interface DesktopInfo {
	version?: string;
	channel?: string;
	arch?: string;
	hardwareArch?: string;
	os?: string;
	osVersion?: string;
	systemVersion?: string;
	runningUnderRosetta?: boolean;
}

export interface TextareaContextMenuParams {
	x: number;
	y: number;
	misspelledWord?: string | null;
	suggestions?: Array<string>;
	editFlags?: Record<string, boolean>;
}

export interface SpellcheckState {
	enabled: boolean;
	languages?: Array<string>;
}

export interface NotificationPayload {
	id?: string;
	title: string;
	body: string;
	icon?: string;
	url?: string;
}

export interface GlobalInputEvent {
	[key: string]: unknown;
}

export interface DisplayMediaRequestInfo {
	audioRequested: boolean;
	videoRequested: boolean;
	supportsLoopbackAudio?: boolean;
	supportsSystemAudioCapture?: boolean;
}

export interface UpdaterEvent {
	type: 'checking' | 'available' | 'not-available' | 'error' | 'downloaded' | 'progress';
	context?: 'user' | 'background' | 'focus';
	version?: string;
	message?: string;
	progress?: number;
}

export interface DownloadResult {
	success: boolean;
	path?: string;
	error?: string;
}

export interface ElectronAPI {
	platform: 'darwin' | 'win32' | 'linux' | string;
	openExternal(url: string): Promise<void>;
	downloadFile(url: string, suggestedName: string): Promise<DownloadResult>;
	onUpdaterEvent(callback: (event: UpdaterEvent) => void): () => void;
	updaterCheck(context: 'user' | 'background'): Promise<void>;
	updaterInstall(): Promise<void>;
	getDesktopSources(types: Array<'screen' | 'window'>, requestId?: string): Promise<Array<DesktopSource>>;
	selectDisplayMediaSource(requestId: string, sourceId: string | null, withAudio: boolean): void;
	getDesktopInfo(): Promise<DesktopInfo>;
	getInitialDeepLink(): Promise<string | null>;
	onDeepLink(callback: (url: string) => void): () => void;
	onTextareaContextMenu(callback: (params: TextareaContextMenuParams) => void): () => void;
	onNotificationClick(callback: (id: string, url?: string) => void): () => void;
	showNotification(payload: NotificationPayload): Promise<{id: string}>;
	closeNotification(id: string): void;
	closeNotifications(ids: Array<string>): void;
	onSpellcheckStateChanged(callback: (state: SpellcheckState) => void): () => void;
	spellcheckGetAvailableLanguages(): Promise<Array<string>>;
	spellcheckSetState(state: SpellcheckState): Promise<SpellcheckState>;
	autostartEnable(): Promise<void>;
	autostartDisable(): Promise<void>;
	autostartIsEnabled(): Promise<boolean>;
	autostartIsInitialized(): Promise<boolean>;
	autostartMarkInitialized(): Promise<void>;
	globalKeyHookStart(): Promise<boolean>;
	globalKeyHookStop(): Promise<void>;
	onGlobalKeyEvent(callback: (event: GlobalInputEvent) => void): () => void;
	onGlobalMouseEvent(callback: (event: GlobalInputEvent) => void): () => void;
	onGlobalShortcut(callback: (id: string) => void): () => void;
	registerGlobalShortcut(id: string, accelerator: string): Promise<void>;
	unregisterAllGlobalShortcuts(): Promise<void>;
	checkInputMonitoringAccess(): Promise<boolean>;
	checkAccessibility(prompt: boolean): Promise<boolean>;
	checkMediaAccess(
		type: 'screen' | 'camera' | 'microphone',
	): Promise<'granted' | 'denied' | 'restricted' | 'not-determined'>;
	requestMediaAccess(type: 'screen' | 'camera' | 'microphone'): Promise<boolean>;
	openAccessibilitySettings(): Promise<void>;
	openInputMonitoringSettings(): Promise<void>;
	openMediaAccessSettings(type: 'screen' | 'camera' | 'microphone'): Promise<void>;
	onDisplayMediaRequested?(callback: (requestId: string, info: DisplayMediaRequestInfo) => void): () => void;
	checkPermission?(type: 'screen' | 'camera' | 'microphone'): Promise<'granted' | 'denied' | 'not-determined'>;
	requestPermission?(type: 'screen' | 'camera' | 'microphone'): Promise<'granted' | 'denied'>;
	onZoomIn?(callback: () => void): () => void;
	onZoomOut?(callback: () => void): () => void;
	onZoomReset?(callback: () => void): () => void;
	onOpenSettings?(callback: () => void): () => void;
	clipboardWriteText?(text: string): Promise<void>;
	setBadgeCount?(count: number): void;
	spellcheckReplaceMisspelling?(word: string): void;
	spellcheckAddWordToDictionary?(word: string): void;
	spellcheckOpenLanguageSettings?(): void;
	onWindowMaximizeChange?(callback: (isMaximized: boolean) => void): () => void;
	windowMinimize?(): void;
	windowMaximize?(): void;
	windowClose?(): void;
	passkeyIsSupported?(): Promise<boolean>;
	passkeyRegister?(options: unknown): Promise<RegistrationResponseJSON>;
	passkeyAuthenticate?(options: unknown): Promise<AuthenticationResponseJSON>;
	onRpcNavigate?(callback: (path: string) => void): () => void;

	switchInstanceUrl?(options: {instanceUrl: string; desktopHandoffCode?: string | null}): Promise<void>;
	consumeDesktopHandoffCode?(): Promise<string | null>;
}
