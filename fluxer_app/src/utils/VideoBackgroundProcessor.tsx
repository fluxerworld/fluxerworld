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
import VoiceSettingsStore, {BLUR_BACKGROUND_ID, NONE_BACKGROUND_ID} from '@app/stores/VoiceSettingsStore';
import * as BackgroundImageDB from '@app/utils/BackgroundImageDB';
import {BackgroundProcessor} from '@livekit/track-processors';
import type {LocalVideoTrack} from 'livekit-client';

const logger = new Logger('VideoBackgroundProcessor');

const MEDIAPIPE_TASKS_VISION_WASM_BASE = `https://fluxerstatic.com/libs/mediapipe/tasks-vision/0.10.14/wasm`;
const MEDIAPIPE_SEGMENTER_MODEL_PATH =
	'https://fluxerstatic.com/libs/mediapipe/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

export interface BackgroundProcessorOptions {
	backgroundImageId?: string;
	backgroundImages?: Array<{id: string; createdAt: number}>;
}

export async function applyBackgroundProcessor(
	track: LocalVideoTrack,
	options?: BackgroundProcessorOptions,
): Promise<ReturnType<typeof BackgroundProcessor> | null> {
	try {
		const voiceSettings = VoiceSettingsStore;
		const backgroundImageId = options?.backgroundImageId ?? voiceSettings.backgroundImageId;
		const backgroundImages = options?.backgroundImages ?? voiceSettings.backgroundImages;

		const isNone = backgroundImageId === NONE_BACKGROUND_ID;
		const isBlur = backgroundImageId === BLUR_BACKGROUND_ID;

		if (isBlur) {
			const processor = BackgroundProcessor({
				mode: 'background-blur',
				blurRadius: 20,
				assetPaths: {
					tasksVisionFileSet: MEDIAPIPE_TASKS_VISION_WASM_BASE,
					modelAssetPath: MEDIAPIPE_SEGMENTER_MODEL_PATH,
				},
			});
			await track.setProcessor(processor);
			logger.info('Applied blur background');
			return processor;
		}

		if (!isNone) {
			const backgroundImage = backgroundImages?.find((img) => img.id === backgroundImageId);
			if (backgroundImage) {
				const imageUrl = await BackgroundImageDB.getBackgroundImageURL(backgroundImage.id);
				if (imageUrl) {
					const processor = BackgroundProcessor({
						mode: 'virtual-background',
						imagePath: imageUrl,
						assetPaths: {
							tasksVisionFileSet: MEDIAPIPE_TASKS_VISION_WASM_BASE,
							modelAssetPath: MEDIAPIPE_SEGMENTER_MODEL_PATH,
						},
					});
					await track.setProcessor(processor);
					logger.info('Applied custom background');
					return processor;
				}
			}
		}

		logger.debug('No background processor applied');
		return null;
	} catch (error) {
		logger.warn('Failed to apply background processor', error);
		return null;
	}
}

export function getMediaPipeAssetPaths() {
	return {
		tasksVisionFileSet: MEDIAPIPE_TASKS_VISION_WASM_BASE,
		modelAssetPath: MEDIAPIPE_SEGMENTER_MODEL_PATH,
	};
}
