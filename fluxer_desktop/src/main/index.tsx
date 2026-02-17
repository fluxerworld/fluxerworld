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

import {createRequire} from 'node:module';
import {BUILD_CHANNEL} from '@electron/common/BuildChannel';
import {loadDesktopConfig} from '@electron/common/DesktopConfig';
import {configureUserDataPath} from '@electron/common/UserDataPath';
import {registerAutostartHandlers} from '@electron/main/Autostart';
import {handleOpenUrl, handleSecondInstance, initializeDeepLinks} from '@electron/main/DeepLinks';
import {cleanupGlobalKeyHook, registerGlobalKeyHookHandlers} from '@electron/main/GlobalKeyHook';
import {cleanupIpcHandlers, registerIpcHandlers} from '@electron/main/IpcHandlers';
import {createApplicationMenu} from '@electron/main/Menu';
import {startRpcServer, stopRpcServer} from '@electron/main/RpcServer';
import {registerUpdater} from '@electron/main/Updater';
import {
	createWindow,
	getMainWindow,
	registerDisplayMediaHandlers,
	setQuitting,
	showWindow,
} from '@electron/main/Window';
import {app, globalShortcut} from 'electron';
import log from 'electron-log';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

const requireModule = createRequire(import.meta.url);

const userDataConfig = configureUserDataPath();
log.info('Configured user data storage', {
	channel: userDataConfig.channel,
	directory: userDataConfig.directoryName,
	path: userDataConfig.base,
});

loadDesktopConfig(userDataConfig.base);

const isCanary = BUILD_CHANNEL === 'canary';

if (process.platform === 'win32') {
	const handledSquirrelEvent = requireModule('electron-squirrel-startup');
	if (handledSquirrelEvent) {
		app.quit();
	}
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.platform === 'win32') {
	app.commandLine.appendSwitch('disable-background-timer-throttling');
	app.commandLine.appendSwitch('disable-renderer-backgrounding');
}

if (process.platform === 'win32') {
	const appId = isCanary ? 'app.fluxer.canary' : 'app.fluxer';
	app.setAppUserModelId(appId);
}

if (process.platform === 'linux') {
	const linuxName = isCanary ? 'Fluxer Canary' : 'Fluxer';
	app.setName(linuxName);
	app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
} else {
	app.on('second-instance', (_event, argv, _workingDirectory) => {
		handleSecondInstance(argv);
	});

	app.on('open-url', (event, url) => {
		event.preventDefault();
		handleOpenUrl(url);
	});

	app.whenReady().then(async () => {
		log.info('App ready, initializing...');

		try {
			initializeDeepLinks();
		} catch (error) {
			log.error('[Init] Failed to initialize deep links:', error);
		}

		try {
			registerIpcHandlers();
		} catch (error) {
			log.error('[Init] Failed to register IPC handlers:', error);
		}

		try {
			registerAutostartHandlers();
		} catch (error) {
			log.error('[Init] Failed to register autostart handlers:', error);
		}

		try {
			registerGlobalKeyHookHandlers();
		} catch (error) {
			log.error('[Init] Failed to register global key hook handlers:', error);
		}

		try {
			registerDisplayMediaHandlers();
		} catch (error: unknown) {
			log.error('[Init] Failed to register display media handlers:', error);
		}

		try {
			createApplicationMenu();
		} catch (error: unknown) {
			log.error('[Init] Failed to create application menu:', error);
		}

		createWindow();
		registerUpdater(getMainWindow);

		app.on('activate', () => {
			const mainWindow = getMainWindow();
			if (mainWindow === null || mainWindow.isDestroyed()) {
				createWindow();
			} else {
				showWindow();
			}
		});

		void startRpcServer().catch((error: unknown) => {
			log.error('[RPC] Failed to start RPC server:', error);
		});

		log.info('App initialized successfully');
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	app.on('before-quit', () => {
		setQuitting(true);
	});

	app.on('will-quit', () => {
		cleanupIpcHandlers();
		cleanupGlobalKeyHook();
		globalShortcut.unregisterAll();
		void stopRpcServer();
	});

	process.on('uncaughtException', (error: unknown) => {
		log.error('Uncaught exception:', error);
	});

	process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
		log.error('Unhandled rejection at:', promise, 'reason:', reason);
	});
}
