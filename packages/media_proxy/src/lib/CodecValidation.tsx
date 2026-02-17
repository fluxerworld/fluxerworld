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

import fs from 'node:fs/promises';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {type FFprobeStream, ffprobe} from '@fluxer/media_proxy/src/lib/FFmpegUtils';
import {MEDIA_TYPES} from '@fluxer/media_proxy/src/lib/MediaTypes';
import {temporaryFile} from 'tempy';

interface AudioStream extends FFprobeStream {
	codec_type: 'audio';
}

function matchesCodecPattern(codec: string, patterns: Set<string>): boolean {
	if (!codec) return false;
	const lowerCodec = codec.toLowerCase();
	return (
		patterns.has(lowerCodec) ||
		Array.from(patterns).some((pattern) => {
			if (pattern.includes('*')) {
				return new RegExp(`^${pattern.replace('*', '.*')}$`).test(lowerCodec);
			}
			return false;
		})
	);
}

function isProRes4444(codec: string): boolean {
	if (!codec) return false;
	const lowercaseCodec = codec.toLowerCase();
	return (
		matchesCodecPattern(lowercaseCodec, MEDIA_TYPES.VIDEO.bannedCodecs) ||
		(lowercaseCodec.includes('prores') && lowercaseCodec.includes('4444'))
	);
}

export function createCodecValidator(logger: LoggerInterface) {
	const validateCodecs = async (buffer: Buffer, filename: string): Promise<boolean> => {
		const ext = filename.split('.').pop()?.toLowerCase();
		if (!ext) return false;

		const tempPath = temporaryFile({extension: ext});

		try {
			await fs.writeFile(tempPath, buffer);
			const probeData = await ffprobe(tempPath);

			if (filename.toLowerCase().endsWith('.ogg')) {
				const hasVideo = probeData.streams?.some((stream) => stream.codec_type === 'video');
				if (hasVideo) return false;

				const audioStream = probeData.streams?.find((stream): stream is AudioStream => stream.codec_type === 'audio');
				return Boolean(audioStream?.codec_name && ['opus', 'vorbis'].includes(audioStream.codec_name));
			}

			const validateStream = (stream: FFprobeStream, type: 'video' | 'audio') => {
				const codec = stream.codec_name || '';
				if (type === 'video') {
					if (isProRes4444(codec)) return false;
					return matchesCodecPattern(codec, MEDIA_TYPES.VIDEO.codecs);
				}
				return matchesCodecPattern(codec, MEDIA_TYPES.AUDIO.codecs);
			};

			for (const stream of probeData.streams || []) {
				if (stream.codec_type === 'video' || stream.codec_type === 'audio') {
					if (!validateStream(stream, stream.codec_type)) {
						logger.debug({filename, codec: stream.codec_name ?? 'unknown'}, `Unsupported ${stream.codec_type} codec`);
						return false;
					}
				}
			}
			return true;
		} catch (err) {
			logger.error({error: err, filename}, 'Failed to validate media codecs');
			return false;
		} finally {
			await fs.unlink(tempPath).catch(() => {});
		}
	};

	return {validateCodecs};
}

export type CodecValidator = ReturnType<typeof createCodecValidator>;
