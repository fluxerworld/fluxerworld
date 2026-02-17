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

export interface VoiceWaveformResult {
	duration: number;
	waveform: string;
}

const logger = new Logger('VoiceMessageRecordingUtils');
const WAVEFORM_MAX_POINTS = 256;
const WAVEFORM_SAMPLE_INTERVAL_SECONDS = 0.1;

function buildWaveformBytes(
	channelData: Float32Array<ArrayBufferLike>,
	durationSeconds: number,
): Uint8Array<ArrayBuffer> {
	const pointCount = Math.min(
		WAVEFORM_MAX_POINTS,
		Math.max(1, Math.ceil(durationSeconds / WAVEFORM_SAMPLE_INTERVAL_SECONDS)),
	);
	const samplesPerPoint = Math.max(1, Math.floor(channelData.length / pointCount));
	const magnitudes = new Array<number>(pointCount).fill(0);
	let maxMagnitude = 0;

	for (let i = 0; i < pointCount; i++) {
		const start = i * samplesPerPoint;
		const end = Math.min(channelData.length, start + samplesPerPoint);
		let sumSquares = 0;
		let count = 0;
		for (let j = start; j < end; j++) {
			const sample = channelData[j];
			sumSquares += sample * sample;
			count++;
		}
		const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
		magnitudes[i] = rms;
		if (rms > maxMagnitude) {
			maxMagnitude = rms;
		}
	}

	const bytes = new Uint8Array(pointCount);
	if (maxMagnitude <= 0) {
		return bytes;
	}

	for (let i = 0; i < pointCount; i++) {
		const normalised = Math.max(0, Math.min(1, magnitudes[i] / maxMagnitude));
		bytes[i] = Math.min(255, Math.round(Math.sqrt(normalised) * 255));
	}

	return bytes;
}

export async function computeVoiceWaveform(blob: Blob): Promise<VoiceWaveformResult> {
	const contextClass =
		window.AudioContext || (window as typeof window & {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
	if (!contextClass) {
		const estimatedDuration = Math.max(1, Math.round(blob.size / 1000));
		return {duration: estimatedDuration, waveform: ''};
	}

	const audioContext = new contextClass();
	try {
		const arrayBuffer = await blob.arrayBuffer();
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		const channelData = audioBuffer.getChannelData(0);
		const duration = Math.max(1, Math.round(audioBuffer.duration));
		const data = buildWaveformBytes(channelData, audioBuffer.duration);
		const binary = String.fromCharCode(...data);
		return {duration, waveform: btoa(binary)};
	} catch (error) {
		logger.warn({error, size: blob.size}, 'Unable to decode waveform');
		return {duration: Math.max(1, Math.round(blob.size / 1000)), waveform: ''};
	} finally {
		audioContext.close().catch(() => {});
	}
}
