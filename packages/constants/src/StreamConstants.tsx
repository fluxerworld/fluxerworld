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

export const STREAM_PREVIEW_MAX_BYTES = 1_000_000;
export const STREAM_PREVIEW_MAX_DIMENSION_PX = 640;
export const STREAM_PREVIEW_MIN_DIMENSION_PX = 160;
export const STREAM_PREVIEW_INITIAL_UPLOAD_INTERVAL_MS = 1000;
export const STREAM_PREVIEW_INITIAL_UPLOAD_MAX_ATTEMPTS = 10;
export const STREAM_PREVIEW_UPLOAD_INTERVAL_MS = 4 * 60 * 1000;
export const STREAM_PREVIEW_UPLOAD_JITTER_MS = 60 * 1000;
export const STREAM_PREVIEW_REFRESH_INTERVAL_MS = 5000;
export const STREAM_PREVIEW_CONTENT_TYPE_JPEG = 'image/jpeg';
export const STREAM_PREVIEW_JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';
export const STREAM_PREVIEW_JPEG_QUALITY_START = 0.7;
export const STREAM_PREVIEW_JPEG_QUALITY_MIN = 0.4;
export const STREAM_PREVIEW_JPEG_QUALITY_STEP = 0.15;
export const STREAM_PREVIEW_DIMENSION_SCALE_STEP = 0.8;
export const STREAM_PREVIEW_ENCODE_ATTEMPTS = 6;
export const STREAM_AUDIO_PREFS_TTL_MS = 6 * 60 * 60 * 1000;
export const STREAM_AUDIO_PREFS_PRUNE_INTERVAL_MS = 10 * 60 * 1000;
export const STREAM_AUDIO_PREFS_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
