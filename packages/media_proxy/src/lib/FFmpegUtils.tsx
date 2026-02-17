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

import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import {promisify} from 'node:util';
import type {MetricsInterface} from '@fluxer/media_proxy/src/types/Metrics';
import type {TracingInterface} from '@fluxer/media_proxy/src/types/Tracing';
import {temporaryFile} from 'tempy';

const execFileAsync = promisify(execFile);

import {
	DEFAULT_FFPROBE_TIMEOUT_MS,
	DEFAULT_FRAME_EXTRACTION_TIMEOUT_MS,
	DEFAULT_THUMBNAIL_TIMEOUT_MS,
} from '@fluxer/constants/src/Timeouts';

export class FFmpegTimeoutError extends Error {
	readonly operation: string;
	readonly timeoutMs: number;

	constructor(operation: string, timeoutMs: number) {
		super(`FFmpeg operation '${operation}' timed out after ${timeoutMs}ms`);
		this.name = 'FFmpegTimeoutError';
		this.operation = operation;
		this.timeoutMs = timeoutMs;
	}
}

function isTimeoutError(error: unknown): boolean {
	if (error instanceof Error && 'killed' in error) {
		return (error as {killed: boolean}).killed === true;
	}
	return false;
}

export interface FFprobeStream {
	codec_name?: string;
	codec_type?: string;
}

interface FFprobeFormat {
	format_name?: string;
	duration?: string;
	size?: string;
}

interface FFprobeResult {
	streams?: Array<FFprobeStream>;
	format?: FFprobeFormat;
}

function parseProbeOutput(stdout: string): FFprobeResult {
	const parsed = JSON.parse(stdout) as unknown;
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Invalid ffprobe output');
	}
	return parsed as FFprobeResult;
}

export async function ffprobe(path: string, timeoutMs = DEFAULT_FFPROBE_TIMEOUT_MS): Promise<FFprobeResult> {
	try {
		const {stdout} = await execFileAsync(
			'ffprobe',
			['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', path],
			{timeout: timeoutMs},
		);
		return parseProbeOutput(stdout);
	} catch (error) {
		if (isTimeoutError(error)) {
			throw new FFmpegTimeoutError('ffprobe', timeoutMs);
		}
		throw error;
	}
}

export async function hasVideoStream(path: string): Promise<boolean> {
	const probeResult = await ffprobe(path);
	return probeResult.streams?.some((stream) => stream.codec_type === 'video') ?? false;
}

export function createFFmpegUtils(options?: {
	metrics?: MetricsInterface | undefined;
	tracing?: TracingInterface | undefined;
}) {
	const {metrics, tracing} = options ?? {};

	const createThumbnail = async (videoPath: string, timeoutMs = DEFAULT_THUMBNAIL_TIMEOUT_MS): Promise<string> => {
		const fn = async () => {
			const startTime = Date.now();
			const hasVideo = await hasVideoStream(videoPath);
			if (!hasVideo) {
				throw new Error('File does not contain a video stream');
			}
			const thumbnailPath = temporaryFile({extension: 'jpg'});
			try {
				await execFileAsync('ffmpeg', ['-i', videoPath, '-vf', 'select=eq(n\\,0)', '-vframes', '1', thumbnailPath], {
					timeout: timeoutMs,
				});
			} catch (error) {
				if (isTimeoutError(error)) {
					throw new FFmpegTimeoutError('thumbnail', timeoutMs);
				}
				throw error;
			}

			const duration = Date.now() - startTime;
			metrics?.histogram({
				name: 'media_proxy.thumbnail.latency',
				dimensions: {},
				valueMs: duration,
			});

			return thumbnailPath;
		};

		if (tracing) {
			return tracing.withSpan(
				{
					name: 'video.thumbnail.create',
					attributes: {
						'video.path': videoPath,
					},
				},
				fn,
			);
		}

		return fn();
	};

	return {createThumbnail};
}

export type FFmpegUtilsType = ReturnType<typeof createFFmpegUtils>;

export interface MediaProbeInfo {
	durationSeconds: number | null;
	hasVideoStream: boolean;
}

export async function getMediaProbeInfo(path: string): Promise<MediaProbeInfo> {
	const probeResult = await ffprobe(path);
	const durationSeconds =
		probeResult.format?.duration && Number.isFinite(Number.parseFloat(probeResult.format.duration))
			? Number.parseFloat(probeResult.format.duration)
			: null;
	const hasVideo = probeResult.streams?.some((stream) => stream.codec_type === 'video') ?? false;
	return {
		durationSeconds,
		hasVideoStream: hasVideo,
	};
}

function clampToDuration(value: number, duration: number | null): number {
	if (!Number.isFinite(duration as number) || (duration ?? 0) <= 0) {
		return Math.max(0, value);
	}
	const maxValue = Math.max(0, (duration as number) - 0.001);
	if (maxValue <= 0) {
		return 0;
	}
	return Math.max(0, Math.min(value, maxValue));
}

function applyJitter(value: number, duration: number | null, jitterPercent: number): number {
	const jitterRadius = Math.max(0.05, Math.abs(value) * jitterPercent);
	const jittered = value + (Math.random() * 2 - 1) * jitterRadius;
	return clampToDuration(jittered, duration);
}

export function computeFrameSampleTimestamps(durationSeconds: number | null, jitterPercent = 0.1): Array<number> {
	const actualDuration =
		Number.isFinite(durationSeconds as number) && (durationSeconds as number) > 0 ? (durationSeconds as number) : null;
	const fallbackDuration = actualDuration ?? 1;

	const startBase = clampToDuration(Math.min(2, Math.max(1, fallbackDuration * 0.1 + 0.5)), actualDuration);
	const middleBase = clampToDuration(fallbackDuration / 2, actualDuration);
	const endCandidate = fallbackDuration > 2 ? fallbackDuration - 1 : fallbackDuration * 0.95;
	const minEnd = startBase + 0.5;
	const endBase = clampToDuration(Math.max(minEnd, endCandidate), actualDuration);

	return [
		applyJitter(startBase, actualDuration, jitterPercent),
		applyJitter(middleBase, actualDuration, jitterPercent),
		applyJitter(endBase, actualDuration, jitterPercent),
	];
}

function normalizeTimestamp(value: number): number {
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function createFrameExtractor(options?: {tracing?: TracingInterface | undefined}) {
	const {tracing} = options ?? {};

	const extractFrameAt = async (
		mediaPath: string,
		timestampSeconds: number,
		timeoutMs = DEFAULT_FRAME_EXTRACTION_TIMEOUT_MS,
	): Promise<string> => {
		const fn = async () => {
			const timestamp = normalizeTimestamp(timestampSeconds);
			const framePath = temporaryFile({extension: 'jpg'});
			try {
				await execFileAsync(
					'ffmpeg',
					[
						'-hide_banner',
						'-loglevel',
						'error',
						'-ss',
						timestamp.toFixed(3),
						'-i',
						mediaPath,
						'-frames:v',
						'1',
						'-q:v',
						'2',
						'-y',
						framePath,
					],
					{timeout: timeoutMs},
				);
			} catch (error) {
				if (isTimeoutError(error)) {
					throw new FFmpegTimeoutError('frame_extraction', timeoutMs);
				}
				throw error;
			}

			try {
				await fs.access(framePath);
			} catch {
				throw new Error(`Frame extraction produced no output at timestamp ${timestamp}`);
			}

			return framePath;
		};

		if (tracing) {
			return tracing.withSpan(
				{
					name: 'video.frame.extract',
					attributes: {
						'video.path': mediaPath,
						'video.timestamp': String(timestampSeconds),
					},
				},
				fn,
			);
		}

		return fn();
	};

	const extractFramesAtTimes = async (mediaPath: string, timestamps: Array<number>): Promise<Array<string>> => {
		if (timestamps.length === 0) {
			timestamps = [0];
		}

		const extractionPromises = timestamps.map((timestamp) => {
			const clampedTimestamp = Math.max(0, timestamp);
			return extractFrameAt(mediaPath, clampedTimestamp);
		});

		const results = await Promise.allSettled(extractionPromises);

		const frames: Array<string> = [];
		for (const result of results) {
			if (result.status === 'fulfilled') {
				frames.push(result.value);
			}
		}

		if (frames.length === 0) {
			const firstError = results.find((r) => r.status === 'rejected');
			if (firstError && firstError.status === 'rejected') {
				throw firstError.reason instanceof Error ? firstError.reason : new Error(String(firstError.reason));
			}
			throw new Error('No frames could be extracted');
		}

		return frames;
	};

	return {extractFrameAt, extractFramesAtTimes};
}

export type FrameExtractor = ReturnType<typeof createFrameExtractor>;
