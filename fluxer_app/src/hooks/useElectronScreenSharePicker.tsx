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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {ScreenRecordingPermissionDeniedModal} from '@app/components/alerts/ScreenRecordingPermissionDeniedModal';
import {ScreenShareSourceModal} from '@app/components/modals/ScreenShareSourceModal';
import {Logger} from '@app/lib/Logger';
import MediaPermissionStore from '@app/stores/MediaPermissionStore';
import type {DesktopSource, DisplayMediaRequestInfo} from '@app/types/electron.d';
import {checkNativePermission} from '@app/utils/NativePermissions';
import {getElectronAPI, isNativeMacOS} from '@app/utils/NativeUtils';
import {useEffect} from 'react';

const logger = new Logger('ElectronScreenSharePicker');
const DESKTOP_SOURCE_TYPES: Array<'screen' | 'window'> = ['screen', 'window'];

const SCREEN_SHARE_SELECTION_TIMEOUT_MS = 55_000;

interface PromptDesktopSourceSelectionOptions {
	audioRequested: boolean;
	supportsLoopbackAudio?: boolean;
	supportsSystemAudioCapture?: boolean;
}

const promptDesktopSourceSelection = (
	sources: Array<DesktopSource>,
	options: PromptDesktopSourceSelectionOptions,
): Promise<string | null> => {
	return new Promise((resolve) => {
		let resolved = false;
		let selectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

		const clearSelectionTimeout = () => {
			if (selectionTimeoutId !== null) {
				clearTimeout(selectionTimeoutId);
				selectionTimeoutId = null;
			}
		};

		const handleSelection = (sourceId: string | null) => {
			if (resolved) return;
			resolved = true;
			clearSelectionTimeout();
			ModalActionCreators.pop();
			resolve(sourceId);
		};

		selectionTimeoutId = setTimeout(() => handleSelection(null), SCREEN_SHARE_SELECTION_TIMEOUT_MS);

		ModalActionCreators.push(
			modal(() => (
				<ScreenShareSourceModal
					sources={sources}
					audioRequested={options.audioRequested}
					supportsLoopbackAudio={options.supportsLoopbackAudio}
					supportsSystemAudioCapture={options.supportsSystemAudioCapture}
					onSelect={handleSelection}
				/>
			)),
		);
	});
};

export const useElectronScreenSharePicker = (): void => {
	useEffect(() => {
		const electronApi = getElectronAPI();
		if (!electronApi || !electronApi.onDisplayMediaRequested) {
			logger.info('Screen share picker unavailable (missing platform handler)');
			return;
		}

		let handlingRequest = false;

		const handleRequest = async (requestId: string, info: DisplayMediaRequestInfo) => {
			if (handlingRequest) {
				electronApi.selectDisplayMediaSource(requestId, null, false);
				return;
			}
			if (!info.videoRequested) {
				logger.warn('Rejecting display media request without a video stream', {
					requestId,
					audioRequested: info.audioRequested,
				});
				electronApi.selectDisplayMediaSource(requestId, null, false);
				return;
			}

			handlingRequest = true;

			try {
				const supportsLoopbackAudio = info.supportsLoopbackAudio ?? false;
				const supportsSystemAudioCapture = info.supportsSystemAudioCapture ?? false;
				const canIncludeAudio = info.audioRequested && (supportsLoopbackAudio || supportsSystemAudioCapture);

				if (isNativeMacOS()) {
					const permission = await checkNativePermission('screen');
					if (permission === 'denied') {
						logger.warn('Screen recording permission denied');
						if (!MediaPermissionStore.isScreenRecordingExplicitlyDenied()) {
							MediaPermissionStore.markScreenRecordingExplicitlyDenied();
							ModalActionCreators.push(modal(() => <ScreenRecordingPermissionDeniedModal />));
						}
						electronApi.selectDisplayMediaSource(requestId, null, false);
						return;
					}
				}

				const sources = await electronApi.getDesktopSources(DESKTOP_SOURCE_TYPES, requestId);
				if (sources.length === 0) {
					logger.warn('No desktop sources available');
					electronApi.selectDisplayMediaSource(requestId, null, false);
					return;
				}
				if (sources.length === 1) {
					electronApi.selectDisplayMediaSource(requestId, sources[0].id, canIncludeAudio);
					return;
				}

				const selectedSourceId = await promptDesktopSourceSelection(sources, {
					audioRequested: info.audioRequested,
					supportsLoopbackAudio,
					supportsSystemAudioCapture,
				});
				electronApi.selectDisplayMediaSource(requestId, selectedSourceId, canIncludeAudio);
			} catch (error) {
				logger.error('Failed to handle display media request', error);
				electronApi.selectDisplayMediaSource(requestId, null, false);
			} finally {
				handlingRequest = false;
			}
		};

		const unsubscribe = electronApi.onDisplayMediaRequested((requestId, info) => {
			void handleRequest(requestId, info);
		});

		return () => {
			unsubscribe();
		};
	}, []);
};
